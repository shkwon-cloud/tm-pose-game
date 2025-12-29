/**
 * main.js
 * 포즈 인식과 게임 로직을 초기화하고 서로 연결하는 진입점
 *
 * PoseEngine, GameEngine, Stabilizer를 조합하여 애플리케이션을 구동
 */

// 전역 변수
let poseEngine;
let gameEngine;
let stabilizer;
let ctx;
let labelContainer;

/**
 * 애플리케이션 초기화
 */
async function init() {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");

  startBtn.disabled = true;

  try {
    // 1. PoseEngine 초기화
    poseEngine = new PoseEngine("./my_model/");
    const { maxPredictions, webcam } = await poseEngine.init({
      size: 200,
      flip: true
    });

    // 2. Stabilizer 초기화
    stabilizer = new PredictionStabilizer({
      threshold: 0.7,
      smoothingFrames: 3
    });

    // 3. GameEngine 초기화
    gameEngine = new FruitCatcherGame();
    setupGameCallbacks();

    // 4. 캔버스 설정
    const canvas = document.getElementById("canvas");
    canvas.width = 200;
    canvas.height = 200;
    ctx = canvas.getContext("2d");

    // 5. Label Container 설정
    labelContainer = document.getElementById("label-container");
    labelContainer.innerHTML = ""; // 초기화
    for (let i = 0; i < maxPredictions; i++) {
      labelContainer.appendChild(document.createElement("div"));
    }

    // 6. PoseEngine 콜백 설정
    poseEngine.setPredictionCallback(handlePrediction);
    poseEngine.setDrawCallback(drawPose);

    // 7. PoseEngine 시작
    poseEngine.start();

    // 8. 게임 자동 시작
    gameEngine.start();

    stopBtn.disabled = false;
    console.log("✅ 초기화 완료! 게임 시작!");
  } catch (error) {
    console.error("초기화 중 오류 발생:", error);
    alert("초기화에 실패했습니다. 콘솔을 확인하세요.");
    startBtn.disabled = false;
  }
}

/**
 * 애플리케이션 중지
 */
function stop() {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");

  if (poseEngine) {
    poseEngine.stop();
  }

  if (gameEngine && gameEngine.isGameActive) {
    gameEngine.stop();
  }

  if (stabilizer) {
    stabilizer.reset();
  }

  startBtn.disabled = false;
  stopBtn.disabled = true;
}

/**
 * 게임 엔진 콜백 설정
 */
function setupGameCallbacks() {
  // 점수 변경 콜백
  gameEngine.setScoreChangeCallback((score, level) => {
    document.getElementById("score-display").textContent = score;
  });

  // 시간 변경 콜백
  gameEngine.setTimeChangeCallback((timeRemaining) => {
    document.getElementById("time-display").textContent = timeRemaining;
  });

  // 놓침 변경 콜백
  gameEngine.setMissChangeCallback((missCount, maxMisses) => {
    document.getElementById("miss-display").textContent = `${missCount}/${maxMisses}`;
  });

  // 레벨 변경 콜백
  gameEngine.setLevelChangeCallback((level) => {
    document.getElementById("level-display").textContent = level;
  });

  // 게임 종료 콜백
  gameEngine.setGameEndCallback((finalScore, finalLevel, missCount) => {
    showGameOverModal(finalScore, finalLevel, missCount);
  });

  // 아이템 생성 콜백
  gameEngine.setItemSpawnCallback((item) => {
    createItemElement(item);
  });

  // 아이템 받기/놓침 콜백
  gameEngine.setItemCatchCallback((item, caught) => {
    removeItemElement(item.id);

    if (caught) {
      showFeedback(item.zone, `+${item.score}`, "success");
    } else if (item.type !== "bomb") {
      showFeedback(item.zone, "놓침!", "miss");
    }
  });

  // 바구니 이동 콜백
  gameEngine.setBasketMoveCallback((position) => {
    updateBasketPosition(position);
  });
}

/**
 * 예측 결과 처리 콜백
 * @param {Array} predictions - TM 모델의 예측 결과
 * @param {Object} pose - PoseNet 포즈 데이터
 */
function handlePrediction(predictions, pose) {
  // 1. Stabilizer로 예측 안정화
  const stabilized = stabilizer.stabilize(predictions);

  // 2. Label Container 업데이트
  for (let i = 0; i < predictions.length; i++) {
    const classPrediction =
      predictions[i].className + ": " + predictions[i].probability.toFixed(2);
    labelContainer.childNodes[i].innerHTML = classPrediction;
  }

  // 3. 최고 확률 예측 표시
  const maxPredictionDiv = document.getElementById("max-prediction");
  maxPredictionDiv.innerHTML = stabilized.className || "감지 중...";

  // 4. GameEngine에 포즈 전달
  if (gameEngine && gameEngine.isGameActive && stabilized.className) {
    gameEngine.onPoseDetected(stabilized.className);
  }
}

/**
 * 포즈 그리기 콜백
 * @param {Object} pose - PoseNet 포즈 데이터
 */
function drawPose(pose) {
  if (poseEngine.webcam && poseEngine.webcam.canvas) {
    ctx.drawImage(poseEngine.webcam.canvas, 0, 0);

    // 키포인트와 스켈레톤 그리기
    if (pose) {
      const minPartConfidence = 0.5;
      tmPose.drawKeypoints(pose.keypoints, minPartConfidence, ctx);
      tmPose.drawSkeleton(pose.keypoints, minPartConfidence, ctx);
    }
  }
}

/**
 * 아이템 DOM 요소 생성
 */
function createItemElement(item) {
  const itemElement = document.createElement("div");
  itemElement.className = "item";
  itemElement.id = `item-${item.id}`;
  itemElement.textContent = item.emoji;
  itemElement.style.left = "50%";
  itemElement.style.transform = "translateX(-50%)";
  itemElement.style.top = "0";

  // 해당 구역에 추가
  const zone = document.querySelector(`.zone[data-zone="${item.zone}"]`);
  if (zone) {
    zone.appendChild(itemElement);

    // 애니메이션 업데이트
    updateItemPosition(item);
  }
}

/**
 * 아이템 위치 업데이트 (애니메이션)
 */
function updateItemPosition(item) {
  const itemElement = document.getElementById(`item-${item.id}`);
  if (!itemElement) return;

  const animate = () => {
    if (!gameEngine.isGameActive) return;

    const currentItem = gameEngine.getItems().find(i => i.id === item.id);
    if (!currentItem) return;

    itemElement.style.top = `${currentItem.position}%`;

    if (currentItem.position < 100) {
      requestAnimationFrame(animate);
    }
  };

  animate();
}

/**
 * 아이템 DOM 요소 제거
 */
function removeItemElement(itemId) {
  const itemElement = document.getElementById(`item-${itemId}`);
  if (itemElement) {
    itemElement.remove();
  }
}

/**
 * 바구니 위치 업데이트
 */
function updateBasketPosition(position) {
  const baskets = document.querySelectorAll(".basket");
  baskets.forEach(basket => {
    if (basket.dataset.zone === position) {
      basket.classList.add("active");
    } else {
      basket.classList.remove("active");
    }
  });
}

/**
 * 피드백 표시 (점수 획득/놓침)
 */
function showFeedback(zone, text, type) {
  const zoneElement = document.querySelector(`.zone[data-zone="${zone}"]`);
  if (!zoneElement) return;

  const feedback = document.createElement("div");
  feedback.textContent = text;
  feedback.style.position = "absolute";
  feedback.style.top = "50%";
  feedback.style.left = "50%";
  feedback.style.transform = "translate(-50%, -50%)";
  feedback.style.fontSize = "24px";
  feedback.style.fontWeight = "bold";
  feedback.style.color = type === "success" ? "#4CAF50" : "#f44336";
  feedback.style.animation = "feedback-fade 1s ease-out";
  feedback.style.pointerEvents = "none";

  zoneElement.appendChild(feedback);

  setTimeout(() => {
    feedback.remove();
  }, 1000);
}

/**
 * 게임 오버 모달 표시
 */
function showGameOverModal(finalScore, finalLevel, missCount) {
  const modal = document.getElementById("game-over-modal");
  const title = document.getElementById("game-over-title");
  const message = document.getElementById("game-over-message");
  const scoreDisplay = document.getElementById("final-score");
  const levelDisplay = document.getElementById("final-level");

  // 게임 오버 원인 판단
  if (missCount >= 3) {
    title.textContent = "😢 게임 오버!";
    message.textContent = "과일을 너무 많이 놓쳤습니다.";
  } else if (gameEngine.timeRemaining <= 0) {
    title.textContent = "⏰ 시간 종료!";
    message.textContent = "수고하셨습니다!";
  } else {
    title.textContent = "💣 게임 오버!";
    message.textContent = "폭탄을 받았습니다!";
  }

  scoreDisplay.textContent = finalScore;
  levelDisplay.textContent = finalLevel;

  modal.classList.remove("hidden");
}

/**
 * 게임 오버 모달 닫기
 */
function closeGameOverModal() {
  const modal = document.getElementById("game-over-modal");
  modal.classList.add("hidden");
}

// CSS 애니메이션 추가 (동적)
const style = document.createElement("style");
style.textContent = `
  @keyframes feedback-fade {
    0% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -100%) scale(1.5);
    }
  }
`;
document.head.appendChild(style);
