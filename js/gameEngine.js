/**
 * gameEngine.js
 * 과일 받기 게임 로직 엔진
 * 
 * 아이템 생성, 낙하, 충돌 검사, 점수 계산 등 게임의 핵심 로직을 담당
 */

class FruitCatcherGame {
  constructor() {
    // 게임 상태
    this.score = 0;
    this.level = 1;
    this.timeRemaining = 60;
    this.missCount = 0;
    this.maxMisses = 3;
    this.isGameActive = false;

    // 바구니 위치 (LEFT, CENTER, RIGHT)
    this.basketPosition = "CENTER";

    // 아이템 배열
    this.items = [];

    // 타이머
    this.gameTimer = null;
    this.spawnTimer = null;
    this.animationId = null;

    // 레벨별 설정
    this.levelConfig = {
      1: { spawnInterval: 2000, fallDuration: 2000 },
      2: { spawnInterval: 1500, fallDuration: 1500 },
      3: { spawnInterval: 1000, fallDuration: 1000 }
    };

    // 아이템 타입 및 확률
    this.itemTypes = [
      { type: "apple", emoji: "🍎", score: 100, probability: 0.4 },
      { type: "pear", emoji: "🍐", score: 150, probability: 0.3 },
      { type: "orange", emoji: "🍊", score: 200, probability: 0.2 },
      { type: "bomb", emoji: "💣", score: 0, probability: 0.1 }
    ];

    // 콜백 함수들
    this.onScoreChange = null;
    this.onTimeChange = null;
    this.onMissChange = null;
    this.onLevelChange = null;
    this.onGameEnd = null;
    this.onItemSpawn = null;
    this.onItemCatch = null;
    this.onBasketMove = null;
  }

  /**
   * 게임 시작
   */
  start() {
    this.isGameActive = true;
    this.score = 0;
    this.level = 1;
    this.timeRemaining = 60;
    this.missCount = 0;
    this.basketPosition = "CENTER";
    this.items = [];

    // 초기 UI 업데이트
    this.notifyScoreChange();
    this.notifyTimeChange();
    this.notifyMissChange();
    this.notifyLevelChange();

    // 타이머 시작
    this.startGameTimer();

    // 아이템 생성 시작
    this.startItemSpawning();

    // 게임 루프 시작
    this.startGameLoop();

    console.log("🎮 게임 시작!");
  }

  /**
   * 게임 중지
   */
  stop() {
    this.isGameActive = false;

    // 모든 타이머 정리
    this.clearTimers();

    // 게임 종료 콜백
    if (this.onGameEnd) {
      this.onGameEnd(this.score, this.level, this.missCount);
    }

    console.log(`🏁 게임 종료! 최종 점수: ${this.score}, 레벨: ${this.level}`);
  }

  /**
   * 게임 타이머 시작 (1초마다)
   */
  startGameTimer() {
    this.gameTimer = setInterval(() => {
      this.timeRemaining--;
      this.notifyTimeChange();

      // 레벨업 체크 (20초마다)
      const elapsedTime = 60 - this.timeRemaining;
      if (elapsedTime > 0 && elapsedTime % 20 === 0 && this.level < 3) {
        this.levelUp();
      }

      // 시간 종료
      if (this.timeRemaining <= 0) {
        this.stop();
      }
    }, 1000);
  }

  /**
   * 아이템 생성 시작
   */
  startItemSpawning() {
    const spawnItem = () => {
      if (!this.isGameActive) return;

      this.spawnRandomItem();

      // 레벨에 따른 생성 간격
      const config = this.levelConfig[this.level] || this.levelConfig[3];
      this.spawnTimer = setTimeout(spawnItem, config.spawnInterval);
    };

    spawnItem();
  }

  /**
   * 랜덤 아이템 생성
   */
  spawnRandomItem() {
    // 랜덤 구역 선택
    const zones = ["LEFT", "CENTER", "RIGHT"];
    const randomZone = zones[Math.floor(Math.random() * zones.length)];

    // 확률 기반 아이템 타입 선택
    const randomValue = Math.random();
    let cumulativeProbability = 0;
    let selectedItem = this.itemTypes[0];

    for (const itemType of this.itemTypes) {
      cumulativeProbability += itemType.probability;
      if (randomValue <= cumulativeProbability) {
        selectedItem = itemType;
        break;
      }
    }

    // 아이템 객체 생성
    const item = {
      id: Date.now() + Math.random(),
      type: selectedItem.type,
      emoji: selectedItem.emoji,
      score: selectedItem.score,
      zone: randomZone,
      position: 0, // 0 (상단) ~ 100 (하단)
      startTime: Date.now(),
      fallDuration: (this.levelConfig[this.level] || this.levelConfig[3]).fallDuration
    };

    this.items.push(item);

    // 아이템 생성 콜백
    if (this.onItemSpawn) {
      this.onItemSpawn(item);
    }
  }

  /**
   * 게임 루프 (아이템 이동 및 충돌 검사)
   */
  startGameLoop() {
    const loop = () => {
      if (!this.isGameActive) return;

      const now = Date.now();
      const itemsToRemove = [];

      // 모든 아이템 업데이트
      for (let i = 0; i < this.items.length; i++) {
        const item = this.items[i];
        const elapsed = now - item.startTime;
        const progress = Math.min(elapsed / item.fallDuration, 1);

        item.position = progress * 100;

        // 화면 하단 도달 (충돌 검사)
        if (progress >= 1) {
          this.checkCollision(item);
          itemsToRemove.push(i);
        }
      }

      // 처리된 아이템 제거 (역순으로)
      for (let i = itemsToRemove.length - 1; i >= 0; i--) {
        this.items.splice(itemsToRemove[i], 1);
      }

      this.animationId = requestAnimationFrame(loop);
    };

    loop();
  }

  /**
   * 충돌 검사
   */
  checkCollision(item) {
    // 바구니와 같은 구역인지 확인
    if (item.zone === this.basketPosition) {
      // 폭탄인 경우 게임 오버
      if (item.type === "bomb") {
        console.log("💣 폭탄 받음! 게임 오버!");
        this.stop();
        return;
      }

      // 과일인 경우 점수 추가
      this.score += item.score;
      this.notifyScoreChange();

      // 아이템 받기 콜백
      if (this.onItemCatch) {
        this.onItemCatch(item, true);
      }

      console.log(`✅ ${item.emoji} 받음! +${item.score}점`);
    } else {
      // 과일을 놓친 경우
      if (item.type !== "bomb") {
        this.missCount++;
        this.notifyMissChange();

        // 아이템 놓침 콜백
        if (this.onItemCatch) {
          this.onItemCatch(item, false);
        }

        console.log(`❌ ${item.emoji} 놓침! (${this.missCount}/${this.maxMisses})`);

        // 3번 놓치면 게임 오버
        if (this.missCount >= this.maxMisses) {
          console.log("😢 과일을 너무 많이 놓쳤습니다! 게임 오버!");
          this.stop();
        }
      } else {
        // 폭탄을 피한 경우
        console.log("✨ 폭탄 회피!");
      }
    }
  }

  /**
   * 레벨업
   */
  levelUp() {
    this.level++;
    this.notifyLevelChange();

    // 기존 스폰 타이머 정리 후 새로운 간격으로 재시작
    if (this.spawnTimer) {
      clearTimeout(this.spawnTimer);
    }
    this.startItemSpawning();

    console.log(`🎉 레벨 ${this.level}! 난이도 증가!`);
  }

  /**
   * 포즈 인식 결과 처리
   */
  onPoseDetected(detectedPose) {
    if (!this.isGameActive) return;

    // 유효한 포즈인지 확인
    if (["LEFT", "CENTER", "RIGHT"].includes(detectedPose)) {
      if (this.basketPosition !== detectedPose) {
        this.basketPosition = detectedPose;

        // 바구니 이동 콜백
        if (this.onBasketMove) {
          this.onBasketMove(detectedPose);
        }
      }
    }
  }

  /**
   * 타이머 정리
   */
  clearTimers() {
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
      this.gameTimer = null;
    }

    if (this.spawnTimer) {
      clearTimeout(this.spawnTimer);
      this.spawnTimer = null;
    }

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  // ========== 콜백 등록 메서드 ==========

  setScoreChangeCallback(callback) {
    this.onScoreChange = callback;
  }

  setTimeChangeCallback(callback) {
    this.onTimeChange = callback;
  }

  setMissChangeCallback(callback) {
    this.onMissChange = callback;
  }

  setLevelChangeCallback(callback) {
    this.onLevelChange = callback;
  }

  setGameEndCallback(callback) {
    this.onGameEnd = callback;
  }

  setItemSpawnCallback(callback) {
    this.onItemSpawn = callback;
  }

  setItemCatchCallback(callback) {
    this.onItemCatch = callback;
  }

  setBasketMoveCallback(callback) {
    this.onBasketMove = callback;
  }

  // ========== 콜백 호출 메서드 ==========

  notifyScoreChange() {
    if (this.onScoreChange) {
      this.onScoreChange(this.score, this.level);
    }
  }

  notifyTimeChange() {
    if (this.onTimeChange) {
      this.onTimeChange(this.timeRemaining);
    }
  }

  notifyMissChange() {
    if (this.onMissChange) {
      this.onMissChange(this.missCount, this.maxMisses);
    }
  }

  notifyLevelChange() {
    if (this.onLevelChange) {
      this.onLevelChange(this.level);
    }
  }

  // ========== 상태 조회 메서드 ==========

  getGameState() {
    return {
      isActive: this.isGameActive,
      score: this.score,
      level: this.level,
      timeRemaining: this.timeRemaining,
      missCount: this.missCount,
      maxMisses: this.maxMisses,
      basketPosition: this.basketPosition,
      itemCount: this.items.length
    };
  }

  getItems() {
    return this.items;
  }
}

// 전역으로 내보내기
window.FruitCatcherGame = FruitCatcherGame;
