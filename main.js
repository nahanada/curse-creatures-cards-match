document.addEventListener('DOMContentLoaded', () => {
    // -----------------------------------------------
    // 状態管理変数
    // -----------------------------------------------
    let currentDifficulty = 16; 
    let cardsArray = [];
    let flippedCards = [];
    let matchedPairs = 0;
    let totalPairs = 0;
    
    let timerId = null;
    let startTime = 0;
    let elapsedTime = 0;
    let isLock = false;
    let isGamePaused = false; // モーダル表示中の時間停止用フラグ

    // -----------------------------------------------
    // DOM要素の取得
    // -----------------------------------------------
    const screens = {
        main: document.getElementById('screen-main'),
        difficulty: document.getElementById('screen-difficulty'),
        game: document.getElementById('screen-game'),
        result: document.getElementById('screen-result'),
        records: document.getElementById('screen-records')
    };

    const cardGrid = document.getElementById('card-grid');
    const gameTimerDisplay = document.getElementById('game-timer');
    const gameInfoDiff = document.getElementById('game-info-diff');
    
    const resultDiff = document.getElementById('result-diff');
    const resultTime = document.getElementById('result-time');
    const resultNewRecordBadge = document.getElementById('result-new-record');
    const btnShareX = document.getElementById('btn-share-x');
    const recordsContainer = document.getElementById('records-container');

    // 中断確認モーダル要素
    const modalAbort = document.getElementById('modal-abort');

    // -----------------------------------------------
    // 画面遷移関数
    // -----------------------------------------------
    function changeScreen(screenKey) {
        Object.keys(screens).forEach(key => {
            if (key === screenKey) {
                screens[key].className = 'screen active';
            } else {
                screens[key].className = 'screen';
            }
        });
    }

    // -----------------------------------------------
    // 背景流動アニメーションの動的生成
    // -----------------------------------------------
    function initBackgroundAnimation() {
        const bgContainer = document.getElementById('bg-animation-container');
        bgContainer.innerHTML = ''; // リセット防止
        const totalItems = 12; 
        
        for (let i = 0; i < totalItems; i++) {
            const bgItem = document.createElement('div');
            bgItem.classList.add('bg-item');
            
            const imgIndex = Math.floor(Math.random() * 16) + 1;
            bgItem.style.backgroundImage = `url('images/${imgIndex}.jpg')`;
            
            bgItem.style.left = `${Math.random() * 100}%`;
            const delay = Math.random() * 20;
            const duration = 15 + Math.random() * 15;
            bgItem.style.animationDelay = `-${delay}s`;
            bgItem.style.animationDuration = `${duration}s`;
            
            const size = 80 + Math.random() * 70;
            bgItem.style.width = `${size}px`;
            bgItem.style.height = `${size}px`;
            
            bgContainer.appendChild(bgItem);
        }
    }

    // -----------------------------------------------
    // 時間フォーマット関数 (秒数 -> 〇分〇〇秒)
    // -----------------------------------------------
    function formatTime(seconds) {
        if (seconds < 60) {
            return `${seconds}秒`;
        } else {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins}分${secs}秒`;
        }
    }

    // -----------------------------------------------
    // タイマー制御 (モーダル表示中は一時停止できるように調整)
    // -----------------------------------------------
    function startTimer() {
        startTime = Date.now() - (elapsedTime * 1000);
        isGamePaused = false;
        
        if (timerId) clearInterval(timerId);
        
        timerId = setInterval(() => {
            if (!isGamePaused) {
                elapsedTime = Math.floor((Date.now() - startTime) / 1000);
                gameTimerDisplay.textContent = formatTime(elapsedTime);
            } else {
                // 中断中は開始時刻をずらしてタイマー進行を止める
                startTime = Date.now() - (elapsedTime * 1000);
            }
        }, 1000);
    }

    function stopTimer() {
        if (timerId) {
            clearInterval(timerId);
            timerId = null;
        }
    }

    // -----------------------------------------------
    // LocalStorage管理 (ベスト3記録)
    // -----------------------------------------------
    function getRecords() {
        const records = localStorage.getItem('curse_creatures_records');
        return records ? JSON.parse(records) : { "8": [], "12": [], "16": [], "24": [], "32": [] };
    }

    function saveRecord(diff, time) {
        const records = getRecords();
        if (!records[diff]) records[diff] = [];
        
        records[diff].push(time);
        records[diff].sort((a, b) => a - b);
        records[diff] = records[diff].slice(0, 3);
        
        localStorage.setItem('curse_creatures_records', JSON.stringify(records));
        return records[diff][0] === time;
    }

    function renderRecordsView() {
        recordsContainer.innerHTML = '';
        const records = getRecords();
        const difficulties = ["8", "12", "16", "24", "32"];
        
        difficulties.forEach(diff => {
            const section = document.createElement('div');
            section.classList.add('diff-record-section');
            
            const title = document.createElement('div');
            title.classList.add('diff-record-title');
            title.textContent = `${diff}枚モード`;
            section.appendChild(title);
            
            const diffRecords = records[diff] || [];
            if (diffRecords.length === 0) {
                const noRec = document.createElement('div');
                noRec.classList.add('no-record');
                noRec.textContent = '記録がありません';
                section.appendChild(noRec);
            } else {
                diffRecords.forEach((time, index) => {
                    const row = document.createElement('div');
                    row.classList.add('record-row');
                    
                    const rankSpan = document.createElement('span');
                    rankSpan.classList.add('record-rank', `rank-${index + 1}`);
                    rankSpan.textContent = `${index + 1}位`;
                    
                    const timeSpan = document.createElement('span');
                    timeSpan.classList.add('record-time');
                    timeSpan.textContent = formatTime(time);
                    
                    row.appendChild(rankSpan);
                    row.appendChild(timeSpan);
                    section.appendChild(row);
                });
            }
            
            recordsContainer.appendChild(section);
        });
    }

    // -----------------------------------------------
    // ゲームコアロジック
    // -----------------------------------------------
    function initGame(numCards) {
        currentDifficulty = numCards;
        totalPairs = numCards / 2;
        matchedPairs = 0;
        flippedCards = [];
        isLock = false;
        elapsedTime = 0;
        isGamePaused = false;
        
        gameInfoDiff.textContent = numCards;
        cardGrid.className = `card-grid grid-${numCards}`;
        cardGrid.innerHTML = '';

        const pool = Array.from({ length: 16 }, (_, i) => i + 1);
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const selectedImages = pool.slice(0, totalPairs);

        cardsArray = [...selectedImages, ...selectedImages];

        for (let i = cardsArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cardsArray[i], cardsArray[j]] = [cardsArray[j], cardsArray[i]];
        }

        cardsArray.forEach((imgId, index) => {
            const card = document.createElement('div');
            card.classList.add('card');
            card.dataset.id = imgId;
            card.dataset.index = index;

            const inner = document.createElement('div');
            inner.classList.add('card-inner');

            const back = document.createElement('div');
            back.classList.add('card-back');
            back.style.backgroundImage = "url('images/back_of_card.jpg')";

            const front = document.createElement('div');
            front.classList.add('card-front');
            front.style.backgroundImage = `url('images/${imgId}.jpg')`;

            inner.appendChild(back);
            inner.appendChild(front);
            card.appendChild(inner);

            card.addEventListener('click', () => handleCardClick(card));
            cardGrid.appendChild(card);
        });

        changeScreen('game');
        startTimer();
    }

    function handleCardClick(card) {
        if (isLock || isGamePaused || card.classList.contains('flipped') || card.classList.contains('matched')) {
            return;
        }

        card.classList.add('flipped');
        flippedCards.push(card);

        if (flippedCards.length === 2) {
            checkMatch();
        }
    }

    function checkMatch() {
        isLock = true;
        const [card1, card2] = flippedCards;

        if (card1.dataset.id === card2.dataset.id) {
            setTimeout(() => {
                card1.classList.add('matched');
                card2.classList.add('matched');
                
                matchedPairs++;
                flippedCards = [];
                isLock = false;

                if (matchedPairs === totalPairs) {
                    endGame();
                }
            }, 300);
        } else {
            setTimeout(() => {
                card1.classList.remove('flipped');
                card2.classList.remove('flipped');
                flippedCards = [];
                isLock = false;
            }, 1000);
        }
    }

    function endGame() {
        stopTimer();
        const isNewBest = saveRecord(currentDifficulty.toString(), elapsedTime);
        
        resultDiff.textContent = `${currentDifficulty}枚モード`;
        resultTime.textContent = formatTime(elapsedTime);
        resultNewRecordBadge.style.display = isNewBest ? 'block' : 'none';
        
        const shareText = `${currentDifficulty}枚モードを ${formatTime(elapsedTime)} でクリアしました！ #特級呪物神経衰弱`;
        const shareUrl = window.location.href.split('?')[0]; 
        btnShareX.href = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;

        setTimeout(() => {
            changeScreen('result');
        }, 600);
    }

    // -----------------------------------------------
    // アプリ内確認モーダルの制御関数
    // -----------------------------------------------
    function showAbortModal() {
        isGamePaused = true; // タイマーとクリックを一時停止
        modalAbort.classList.add('active');
    }

    function hideAbortModal() {
        modalAbort.classList.remove('active');
        isGamePaused = false;
        // 開始時間を補正して再スタート
        startTime = Date.now() - (elapsedTime * 1000);
    }

    // -----------------------------------------------
    // イベントリスナー設定
    // -----------------------------------------------
    document.getElementById('btn-play-menu').addEventListener('click', () => changeScreen('difficulty'));
    document.getElementById('btn-records-menu').addEventListener('click', () => {
        renderRecordsView();
        changeScreen('records');
    });

    document.querySelectorAll('.btn-diff').forEach(btn => {
        btn.addEventListener('click', () => {
            const numCards = parseInt(btn.dataset.cards, 10);
            initGame(numCards);
        });
    });

    // 中断ボタンをトリガーしてアプリ内モーダルを出す
    document.getElementById('btn-abort-trigger').addEventListener('click', () => {
        showAbortModal();
    });

    // モーダル：はい（メインに戻る）
    document.getElementById('btn-abort-yes').addEventListener('click', () => {
        modalAbort.classList.remove('active');
        stopTimer();
        changeScreen('main');
    });

    // モーダル：いいえ（再開する）
    document.getElementById('btn-abort-no').addEventListener('click', () => {
        hideAbortModal();
    });

    document.getElementById('btn-retry').addEventListener('click', () => {
        initGame(currentDifficulty);
    });

    document.querySelectorAll('.btn-back').forEach(btn => {
        btn.addEventListener('click', () => changeScreen('main'));
    });

    initBackgroundAnimation();
});
