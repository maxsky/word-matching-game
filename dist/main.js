
import {loadSettingFromDB, loadWordsFromDB} from './sqlite.js';

let wordPairs = []; // Array of { english, chinese } objects loaded from DB
let currentCards = []; // Cards for the current single player game
let selectedCards = []; // Currently selected cards in single player
let matchedPairs = 0; // Count of matched pairs in single player
let score = 0;
let timer = 0;
let timerInterval;
let gamesPlayed = 0;
let highScore = 0;
let pairCount = 8; // Default number of pairs for a game

// UI elements (re-declare for clarity, ensure they are accessible)
const homeScreen = document.getElementById('homeScreen');
const gameScreen = document.getElementById('gameScreen');
const editScreen = document.getElementById('editScreen');
const tutorialScreen = document.getElementById('tutorialScreen');
const twoPlayerGameScreen = document.getElementById('twoPlayerGameScreen'); // Added for two-player game

const totalWordsDisplay = document.getElementById('totalWords');
const gamesPlayedDisplay = document.getElementById('gamesPlayedDisplay');
const highScoreDisplay = document.getElementById('highScoreDisplay');
const timeDisplay = document.getElementById('time');
const scoreDisplay = document.getElementById('score');
const cardsGrid = document.getElementById('cardsGrid'); // For single player
const wordList = document.getElementById('wordList'); // For edit screen
const pairCountSelect = document.getElementById('pairCountSelect');
const customPairCountInput = document.getElementById('customPairCountInput');

// Custom Modals elements
const messageModal = document.getElementById('messageModal');
const messageModalTitle = document.getElementById('messageModalTitle');
const messageModalBody = document.getElementById('messageModalBody');
const messageModalCloseBtn = document.getElementById('messageModalCloseBtn');

const confirmModal = document.getElementById('confirmModal');
const confirmModalTitle = document.getElementById('confirmModalTitle');
const confirmModalBody = document.getElementById('confirmModalBody');
const confirmModalConfirmBtn = document.getElementById('confirmModalConfirmBtn');
const confirmModalCancelBtn = document.getElementById('confirmModalCancelBtn');

let currentConfirmCallback = null;

// Two-Player Specific Elements
const player1EnglishWordsDiv = document.getElementById('player1EnglishWords');
const player1ChineseWordsDiv = document.getElementById('player1ChineseWords');
const player1ScoreDisplay = document.getElementById('player1ScoreDisplay'); // Updated ID

const player2EnglishWordsDiv = document.getElementById('player2EnglishWords');
const player2ChineseWordsDiv = document.getElementById('player2ChineseWords');
const player2ScoreDisplay = document.getElementById('player2ScoreDisplay'); // Updated ID

// Player 1 state
let player1SelectedEnglishCard = null;
let player1SelectedChineseCard = null;
let player1Score = 0;
let player1MatchedPairs = 0;
let player1TotalPairs = 0;

// Player 2 state
let player2SelectedEnglishCard = null;
let player2SelectedChineseCard = null;
let player2Score = 0;
let player2MatchedPairs = 0;
let player2TotalPairs = 0;


// Function to display custom message modal
function displayMessage(message, type = 'info', title = '提示') {
    messageModalTitle.textContent = title;
    messageModalBody.innerHTML = `<p>${message}</p>`; // Use innerHTML for simple text or basic HTML
    messageModalBody.className = `modal-message ${type}`; // Add type class for styling (success, error, info)
    messageModal.classList.add('active'); // Show the modal with animation
    console.log(`Displaying message: ${message}`);
}

// Function to show custom confirm modal
function showConfirmModal(message, onConfirm, onCancel = null) {
    confirmModalTitle.textContent = '确认操作'; // Default title
    confirmModalBody.textContent = message;
    confirmModal.classList.add('active'); // Show the modal with animation
    currentConfirmCallback = onConfirm; // Store the confirmation callback

    // Handle cancel button click
    confirmModalCancelBtn.onclick = () => {
        confirmModal.classList.remove('active');
        if (onCancel) onCancel(); // Execute cancel callback if provided
        currentConfirmCallback = null; // Clear callback
    };
}

// Add event listener for message modal close button
messageModalCloseBtn.addEventListener('click', () => {
    messageModal.classList.remove('active');
});

// Add event listener for confirm modal confirm button
confirmModalConfirmBtn.addEventListener('click', () => {
    confirmModal.classList.remove('active');
    if (currentConfirmCallback) {
        currentConfirmCallback(); // Execute the stored confirm callback
        currentConfirmCallback = null; // Clear callback
    }
});


// Function to switch between screens
function showScreen(screenToShow) {
    const screens = [homeScreen, gameScreen, editScreen, tutorialScreen, twoPlayerGameScreen];

    screens.forEach(screen => {
        if (screen === screenToShow) {
            screen.classList.add('active');
        } else {
            screen.classList.remove('active');
        }
    });
    // 当切换到主页时，确保统计数据是最新的
    if (screenToShow === homeScreen) {
        updateStats();
    }
}

// Flag to indicate if DB is fully initialized and ready for operations
// 在 Tauri 中，数据库在 Rust 后端初始化，前端不需直接检查
// 仅用于控制前端是否可以进行游戏操作，防止在数据未加载前就开始游戏
let dataLoaded = false;

// Function to initialize the application (load data and settings)
async function initializeApp() {
    if (dataLoaded) { // Ensure it runs only once
        console.log('initializeApp: Data already loaded. Skipping.');
        return;
    }

    console.log('initializeApp: Starting data and settings loading.');

    try {
        // 在 Tauri 中，调用 Rust 后端的 init_db 命令来确保数据库表被创建和默认数据被插入
        // await invoke('init_db');
        console.log('Rust 后端数据库初始化完成.');

        loadWordsFromDB(); // 加载单词

        dataLoaded = true; // 标记数据已加载
        console.log('所有必要数据和功能已加载。');

        // After successful initialization, set the initial screen
        const firstTime = loadSettingFromDB('firstTime'); // 直接等待结果
        // 'true' 是为了兼容旧的 null 或未设置的情况
        if (firstTime === null || firstTime === 'true') { // 确保是 'true' 字符串或 null (首次启动)
            await saveSettingToDB('firstTime', 'false'); // 保存设置
            showScreen(tutorialScreen);
        } else {
            showScreen(homeScreen);
        }

    } catch (err) {
        console.error('加载应用数据失败:', err);
        displayMessage('加载应用数据失败。请尝试重新启动应用。', 'error');
    }
}


// Function to update stats on the home screen
function updateStats() {
    totalWordsDisplay.textContent = wordPairs.length;
    gamesPlayedDisplay.textContent = gamesPlayed;
    highScoreDisplay.textContent = highScore;

    // 确保设置界面上的单词对数显示与当前值同步
    if (pairCountSelect && customPairCountInput) {
        pairCountSelect.value = pairCount;
        customPairCountInput.value = pairCount;
    }
    console.log('Stats updated.');
}

// Single Player Game Logic
function initGame() {
    if (!dataLoaded) { // 检查数据是否已加载
        displayMessage('游戏正在加载中，请稍候...', 'info');
        return;
    }
    if (wordPairs.length < pairCount) {
        displayMessage(`单词库中至少需要 ${pairCount} 个单词才能开始游戏，当前只有 ${wordPairs.length} 个。请添加更多单词。`, 'error');
        showScreen(editScreen); // Go to edit screen to add more words
        return;
    }

    score = 0;
    matchedPairs = 0;
    selectedCards = [];
    clearInterval(timerInterval);
    timer = 0;
    timeDisplay.textContent = timer;
    scoreDisplay.textContent = score;

    // Select random pairs for the game
    const shuffledWordPairs = [...wordPairs].sort(() => 0.5 - Math.random());
    currentCards = shuffledWordPairs.slice(0, pairCount).flatMap(pair => [
        {type: 'english', value: pair.english, match: pair.chinese},
        {type: 'chinese', value: pair.chinese, match: pair.english}
    ]);
    currentCards.sort(() => 0.5 - Math.random()); // Shuffle again for card positions

    // Set the data-pair-count attribute for CSS grid adjustments
    cardsGrid.setAttribute('data-pair-count', pairCount);

    renderGameCards(cardsGrid, currentCards, false); // Render for single player
    showScreen(gameScreen);

    gamesPlayed++;
    saveSettingToDB('gamesPlayed', gamesPlayed); // Save updated gamesPlayed
    updateStats(); // Update stats on home screen after game starts

    timerInterval = setInterval(() => {
        timer++;
        timeDisplay.textContent = timer;
    }, 1000);
    console.log('Single player game initialized.');
}

function renderGameCards(targetElement, cardsData, isTwoPlayer = false) {
    targetElement.innerHTML = '';
    cardsData.forEach((cardData, index) => {
        const card = document.createElement('div');
        card.classList.add('card');
        // Adjust card size based on number of pairs and screen size
        const cardCount = cardsData.length;
        let fontSize = 1.2; // Base font size
        if (cardCount > 12) { // More cards, smaller font
            fontSize = 1.2 - ((cardCount - 12) * 0.05); // Reduce font size gradually
            fontSize = Math.max(0.8, fontSize); // Minimum font size
        }
        card.style.fontSize = `${fontSize}em`;

        card.dataset.index = index; // Store original index for identifying cards
        card.dataset.type = cardData.type; // Store card type
        card.dataset.value = cardData.value; // Store card value
        card.dataset.match = cardData.match; // Store card match value

        if (isTwoPlayer) {
            card.dataset.player = cardData.player; // Store player number for two-player game
        }

        const cardInner = document.createElement('div');
        cardInner.classList.add('card-inner');

        const cardFront = document.createElement('div');
        cardFront.classList.add('card-face', 'card-front');
        cardFront.textContent = '?'; // Display question mark on front

        const cardBack = document.createElement('div');
        cardBack.classList.add('card-face', 'card-back');
        cardBack.textContent = cardData.value; // Display the word/meaning

        cardInner.appendChild(cardFront);
        cardInner.appendChild(cardBack);
        card.appendChild(cardInner);

        if (isTwoPlayer) {
            card.addEventListener('click', (e) => handleTwoPlayerCardClick(card)); // Pass card element directly
        } else {
            card.addEventListener('click', () => flipCard(card, cardData));
        }

        targetElement.appendChild(card);
    });
}

// Single Player Flip Card Logic
function flipCard(cardElement, cardData) {
    if (selectedCards.length < 2 && !cardElement.classList.contains('flipped') && !cardElement.classList.contains('matched')) {
        cardElement.classList.add('flipped', 'selected');
        selectedCards.push({element: cardElement, data: cardData});

        if (selectedCards.length === 2) {
            setTimeout(checkMatch, 1000); // Check for match after 1 second
        }
    }
}

function checkMatch() {
    const [card1, card2] = selectedCards;
    const data1 = card1.data;
    const data2 = card2.data;

    // Check if values match correctly (e.g., english matches chinese, and chinese matches english)
    // Also ensure that the selected cards are not the same card (e.g., clicked the same card twice)
    if (data1.value === data2.match && data2.value === data1.match && card1.element !== card2.element) {
        // Match found
        card1.element.classList.add('matched');
        card2.element.classList.add('matched');
        card1.element.classList.remove('selected');
        card2.element.classList.remove('selected');
        matchedPairs++;
        score += 10;
        scoreDisplay.textContent = score;

        if (matchedPairs === pairCount) {
            clearInterval(timerInterval);
            displayMessage(`恭喜！您在 ${timer} 秒内完成了游戏！您的得分是 ${score}！`, 'success', '游戏结束');
            if (score > highScore) {
                highScore = score;
                saveSettingToDB('highScore', highScore); // Save updated high score
                displayMessage(`恭喜！您打破了最高分记录！新最高分是 ${highScore}！`, 'success', '新纪录！');
            }
            updateStats(); // Update stats on home screen after game ends
        }
    } else {
        // No match, flip back
        card1.element.classList.remove('selected');
        card2.element.classList.remove('selected');
        setTimeout(() => {
            card1.element.classList.remove('flipped');
            card2.element.classList.remove('flipped');
        }, 500); // Allow some time to see the cards before flipping back
        score = Math.max(0, score - 2); // Deduct points for incorrect match
        scoreDisplay.textContent = score;
    }
    selectedCards = []; // Reset selected cards
}

// Two-Player Game Logic
function initTwoPlayerGame() {
    if (!dataLoaded) { // 检查数据是否已加载
        displayMessage('游戏正在加载中，请稍候...', 'info');
        return;
    }
    if (wordPairs.length < pairCount) {
        displayMessage(`单词库中至少需要 ${pairCount} 个单词才能开始游戏，当前只有 ${wordPairs.length} 个。请添加更多单词。`, 'error');
        showScreen(editScreen);
        return;
    }

    // Reset player states
    player1Score = 0;
    player1MatchedPairs = 0;
    player1SelectedEnglishCard = null;
    player1SelectedChineseCard = null;
    player1ScoreDisplay.textContent = `得分: ${player1Score}`;

    player2Score = 0;
    player2MatchedPairs = 0;
    player2SelectedEnglishCard = null;
    player2SelectedChineseCard = null;
    player2ScoreDisplay.textContent = `得分: ${player2Score}`;

    // Randomly select pairs for each player, ensuring they are distinct if needed or just random from total
    const totalGamePairs = pairCount; // Total pairs for the game
    player1TotalPairs = totalGamePairs;
    player2TotalPairs = totalGamePairs;

    const shuffledPairs = [...wordPairs].sort(() => 0.5 - Math.random()).slice(0, totalGamePairs);

    // Prepare cards for Player 1
    const player1EnglishCardsData = shuffledPairs.map(pair => ({
        type: 'english',
        value: pair.english,
        match: pair.chinese,
        player: 1
    }));
    const player1ChineseCardsData = shuffledPairs.map(pair => ({
        type: 'chinese',
        value: pair.chinese,
        match: pair.english,
        player: 1
    }));
    player1EnglishCardsData.sort(() => 0.5 - Math.random());
    player1ChineseCardsData.sort(() => 0.5 - Math.random());

    // Prepare cards for Player 2 (using potentially the same words, but separate card instances)
    const player2EnglishCardsData = shuffledPairs.map(pair => ({
        type: 'english',
        value: pair.english,
        match: pair.chinese,
        player: 2
    }));
    const player2ChineseCardsData = shuffledPairs.map(pair => ({
        type: 'chinese',
        value: pair.chinese,
        match: pair.english,
        player: 2
    }));
    player2EnglishCardsData.sort(() => 0.5 - Math.random());
    player2ChineseCardsData.sort(() => 0.5 - Math.random());


    // Render cards for each player in their respective sections
    renderGameCards(player1EnglishWordsDiv, player1EnglishCardsData, true);
    renderGameCards(player1ChineseWordsDiv, player1ChineseCardsData, true);
    renderGameCards(player2EnglishWordsDiv, player2EnglishCardsData, true);
    renderGameCards(player2ChineseWordsDiv, player2ChineseCardsData, true);

    showScreen(twoPlayerGameScreen);

    gamesPlayed++;
    saveSettingToDB('gamesPlayed', gamesPlayed);
    updateStats();
    console.log('Two player game initialized.');
}

// Central handler for two-player card clicks
function handleTwoPlayerCardClick(cardElement) {
    const player = parseInt(cardElement.dataset.player);
    const cardType = cardElement.dataset.type;
    const cardValue = cardElement.dataset.value;
    const cardMatch = cardElement.dataset.match;

    if (cardElement.classList.contains('flipped') || cardElement.classList.contains('matched')) {
        return; // Card already flipped or matched
    }

    if (player === 1) {
        if (cardType === 'english') {
            if (player1SelectedEnglishCard) player1SelectedEnglishCard.classList.remove('selected');
            player1SelectedEnglishCard = cardElement;
        } else { // chinese
            if (player1SelectedChineseCard) player1SelectedChineseCard.classList.remove('selected');
            player1SelectedChineseCard = cardElement;
        }
        cardElement.classList.add('flipped', 'selected');

        // Check for match if both English and Chinese cards are selected for Player 1
        if (player1SelectedEnglishCard && player1SelectedChineseCard) {
            checkTwoPlayerMatch(player1SelectedEnglishCard, player1SelectedChineseCard, 1);
        }
    } else { // Player 2
        if (cardType === 'english') {
            if (player2SelectedEnglishCard) player2SelectedEnglishCard.classList.remove('selected');
            player2SelectedEnglishCard = cardElement;
        } else { // chinese
            if (player2SelectedChineseCard) player2SelectedChineseCard.classList.remove('selected');
            player2SelectedChineseCard = cardElement;
        }
        cardElement.classList.add('flipped', 'selected');

        // Check for match if both English and Chinese cards are selected for Player 2
        if (player2SelectedEnglishCard && player2SelectedChineseCard) {
            checkTwoPlayerMatch(player2SelectedEnglishCard, player2SelectedChineseCard, 2);
        }
    }
}

function checkTwoPlayerMatch(englishCardElement, chineseCardElement, playerNum) {
    const englishWord = englishCardElement.textContent; // Get content directly
    const chineseWord = chineseCardElement.textContent;

    // wordPairs 是全局变量，由 loadWordsFromDB 从 Rust 后端获取
    const isMatch = wordPairs.some(pair =>
        pair.english === englishWord && pair.chinese === chineseWord
    );

    let message = '';
    if (isMatch) {
        englishCardElement.classList.add('matched');
        chineseCardElement.classList.add('matched');
        englishCardElement.classList.remove('selected');
        chineseCardElement.classList.remove('selected');

        if (playerNum === 1) {
            player1Score += 10;
            player1MatchedPairs++;
            player1ScoreDisplay.textContent = `得分: ${player1Score}`;
            message = `玩家1：正确! ${englishWord} - ${chineseWord}`;
        } else {
            player2Score += 10;
            player2MatchedPairs++;
            player2ScoreDisplay.textContent = `得分: ${player2Score}`;
            message = `玩家2：正确! ${englishWord} - ${chineseWord}`;
        }
        displayMessage(message, 'success');

    } else {
        englishCardElement.classList.remove('selected');
        chineseCardElement.classList.remove('selected');
        // Only remove 'flipped' class after a short delay for visual feedback
        setTimeout(() => {
            englishCardElement.classList.remove('flipped');
            chineseCardElement.classList.remove('flipped');
        }, 500);

        if (playerNum === 1) {
            player1Score = Math.max(0, player1Score - 2);
            player1ScoreDisplay.textContent = `得分: ${player1Score}`;
            message = `玩家1：错误! ${englishWord} 和 ${chineseWord} 不匹配`;
        } else {
            player2Score = Math.max(0, player2Score - 2);
            player2ScoreDisplay.textContent = `得分: ${player2Score}`;
            message = `玩家2：错误! ${englishWord} 和 ${chineseWord} 不匹配`;
        }
        displayMessage(message, 'error');
    }

    // Reset selected cards for the current player
    if (playerNum === 1) {
        player1SelectedEnglishCard = null;
        player1SelectedChineseCard = null;
    } else {
        player2SelectedEnglishCard = null;
        player2SelectedChineseCard = null;
    }

    checkTwoPlayerGameEnd();
}

function checkTwoPlayerGameEnd() {
    const allPlayer1Matched = (player1MatchedPairs === player1TotalPairs);
    const allPlayer2Matched = (player2MatchedPairs === player2TotalPairs);

    if (allPlayer1Matched && allPlayer2Matched) {
        displayMessage(`双人游戏结束！玩家1得分: ${player1Score}，玩家2得分: ${player2Score}`, 'info', '游戏结束');
        // You can add logic here to determine the winner
    } else if (allPlayer1Matched) {
        displayMessage('玩家1已完成所有配对！等待玩家2...', 'info');
    } else if (allPlayer2Matched) {
        displayMessage('玩家2已完成所有配对！等待玩家1...', 'info');
    }
}

// Edit Screen Logic (Render and Event listeners for adding/editing/deleting words)
function renderWordList() {
    if (!dataLoaded) { // 检查数据是否已加载
        displayMessage('数据库功能尚未准备好，无法加载单词列表。', 'warning');
        return;
    }

    wordList.innerHTML = ''; // Clear existing list

    if (wordPairs.length === 0) {
        wordList.innerHTML = '<p style="text-align: center; padding: 20px; color: #888;">暂无单词，请添加。</p>';
        return;
    }

    wordPairs.forEach(pair => {
        const wordItem = document.createElement('div');
        wordItem.classList.add('word-item');
        wordItem.innerHTML = `
                <span><strong>${pair.english}</strong> - ${pair.chinese}</span>
                <div class="word-actions">
                    <button class="edit-btn" data-english="${pair.english}" data-chinese="${pair.chinese}" title="编辑"><i class="fas fa-edit"></i></button>
                    <button class="delete-btn" data-english="${pair.english}" title="删除"><i class="fas fa-trash"></i></button>
                </div>
            `;
        wordList.appendChild(wordItem);
    });

    // Add event listeners for edit and delete buttons
    wordList.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const englishToEdit = event.currentTarget.dataset.english;
            const chineseToEdit = event.currentTarget.dataset.dataset.chinese;
            document.getElementById('englishWord').value = englishToEdit;
            document.getElementById('chineseMeaning').value = chineseToEdit;
            document.getElementById('englishWord').focus();
        });
    });

    wordList.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const englishToDelete = event.currentTarget.dataset.english;
            // Use custom confirm modal
            showConfirmModal(`确定要删除单词 '${englishToDelete}' 吗？`, () => {
                deleteWordFromDB(englishToDelete); // User confirmed deletion
            });
        });
    });
}


// Event Listeners for buttons
document.getElementById('startGameBtn').addEventListener('click', initGame);

document.getElementById('startTwoPlayerGameBtn').addEventListener('click', initTwoPlayerGame);

document.getElementById('editWordsBtn').addEventListener('click', () => {
    showScreen(editScreen);
    renderWordList(); // Render list when navigating to edit screen
});

document.getElementById('viewTutorialBtn').addEventListener('click', () => {
    showScreen(tutorialScreen);
});

document.getElementById('resetGameBtn').addEventListener('click', () => {
    showConfirmModal('确定要重置当前游戏吗？', () => {
        initGame(); // User confirmed reset
    });
});

document.getElementById('resetTwoPlayerGameBtn').addEventListener('click', () => {
    showConfirmModal('确定要重置双人游戏吗？', () => {
        initTwoPlayerGame(); // User confirmed reset
    });
});

document.getElementById('addWordBtn').addEventListener('click', () => {
    saveWordToDB();
});

document.getElementById('backToHomeFromGame').addEventListener('click', () => {
    clearInterval(timerInterval); // Stop timer when leaving game screen
    showScreen(homeScreen);
});

document.getElementById('backToHomeFromTwoPlayerGame').addEventListener('click', () => {
    showScreen(homeScreen);
});

document.getElementById('backToHomeFromEdit').addEventListener('click', () => {
    showScreen(homeScreen);
});

document.getElementById('backToHomeFromTutorial').addEventListener('click', () => {
    showScreen(homeScreen);
});

// 单词对数设置事件
if (pairCountSelect && customPairCountInput) {
    pairCountSelect.addEventListener('change', () => {
        customPairCountInput.value = pairCountSelect.value;
        savePairCountSetting();
    });

    customPairCountInput.addEventListener('change', () => {
        const value = parseInt(customPairInput.value, 10);
        if (isNaN(value) || value < 4) {
            customPairCountInput.value = 4;
        } else if (value > 50) {
            customPairCountInput.value = 50;
        }
        savePairCountSetting();
    });
}

// Initial application setup on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired. Starting initializeApp.');
    initializeApp(); // This will handle all initial DB loading, settings, and screen display.
});
