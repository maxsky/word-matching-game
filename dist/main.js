import {SQLiteHandler} from './sqlite.js';

const tauri = window.__TAURI__;
const Database = tauri.sql;
const filename = 'words.db';

let wordPairs = []; // Array of { english, chinese } objects loaded from DB
let currentCards = []; // Cards for the current single player game
let selectedEnglishCard = null; // Currently selected English card in single player
let selectedChineseCard = null; // Currently selected Chinese card in single player
let matchedPairs = 0; // Count of matched pairs in single player
let score = 0;
let timer = 0;
let timerInterval;
let gamesPlayed = 0;
let highScore = 0;
let pairCount = 8; // Default number of pairs for a game

// UI elements
const homeScreen = document.getElementById('homeScreen');
const gameScreen = document.getElementById('gameScreen');
const editScreen = document.getElementById('editScreen');
const tutorialScreen = document.getElementById('tutorialScreen');
const twoPlayerGameScreen = document.getElementById('twoPlayerGameScreen');

const totalWordsDisplay = document.getElementById('totalWords');
const gamesPlayedDisplay = document.getElementById('gamesPlayedDisplay');
const highScoreDisplay = document.getElementById('highScoreDisplay');
const timeDisplay = document.getElementById('time');
const scoreDisplay = document.getElementById('score');
const englishColumn = document.getElementById('englishColumn'); // For single player English words
const chineseColumn = document.getElementById('chineseColumn'); // For single player Chinese words
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
const player1EnglishColumn = document.getElementById('player1EnglishColumn');
const player1ChineseColumn = document.getElementById('player1ChineseColumn');
const player1ScoreDisplay = document.getElementById('player1ScoreDisplay');

const player2EnglishColumn = document.getElementById('player2EnglishColumn');
const player2ChineseColumn = document.getElementById('player2ChineseColumn');
const player2ScoreDisplay = document.getElementById('player2ScoreDisplay');

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

let sqlite;
// Used to control whether the frontend can perform game operations, preventing the game from starting before data is loaded
let dataLoaded = false;

// --- Modal Functions ---
function displayMessage(message, type = 'info', title = '提示') {
    messageModalTitle.textContent = title;
    messageModalBody.innerHTML = `<p>${message}</p>`; // Use innerHTML for simple text or basic HTML
    messageModalBody.className = `modal-message ${type}`; // Add type class for styling (success, error, info)
    messageModal.classList.add('active'); // Show the modal with animation
    console.log(`Displaying message: ${message}`);
}

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

messageModalCloseBtn.addEventListener('click', () => {
    messageModal.classList.remove('active');
});

confirmModalConfirmBtn.addEventListener('click', () => {
    confirmModal.classList.remove('active');
    if (currentConfirmCallback) {
        currentConfirmCallback(); // Execute the stored confirm callback
        currentConfirmCallback = null; // Clear callback
    }
});

// --- Screen Management ---
function showScreen(screenToShow) {
    const screens = [homeScreen, gameScreen, editScreen, tutorialScreen, twoPlayerGameScreen];

    screens.forEach(screen => {
        if (screen === screenToShow) {
            screen.classList.add('active');
        } else {
            screen.classList.remove('active');
        }
    });

    // When switching to home page, ensure stats are up-to-date
    if (screenToShow === homeScreen) {
        updateStats();
    }
}

// Function to update stats on the home screen
function updateStats() {
    totalWordsDisplay.textContent = wordPairs.length;
    gamesPlayedDisplay.textContent = gamesPlayed;
    highScoreDisplay.textContent = highScore;

    // Ensure pair count display in settings is synchronized with current value
    if (pairCountSelect && customPairCountInput) {
        pairCountSelect.value = pairCount;
        customPairCountInput.value = pairCount;
    }

    console.log('Stats updated.');
}

// --- Word List Management (Edit Screen) ---
function renderWordList() {
    if (!dataLoaded) {
        displayMessage('数据库功能尚未准备好，无法加载单词列表。', 'warning');
        return;
    }

    wordList.innerHTML = '';

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
            document.getElementById('chineseMeaning').value = event.currentTarget.dataset.chinese;

            let english = document.getElementById('englishWord');

            english.value = event.currentTarget.dataset.english;
            english.focus();
        });
    });

    wordList.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const englishToDelete = event.currentTarget.dataset.english;

            showConfirmModal(`确定要删除单词 '${englishToDelete}' 吗？`, () => {
                sqlite.deleteWordFromDB(englishToDelete).then(() => {
                    reloadWordList();
                });
            });
        });
    });
}

async function reloadWordList() {
    wordPairs = await sqlite.loadWordsFromDB();

    updateStats();
    renderWordList();
}

async function initializeApp() {
    if (dataLoaded) { // Ensure it runs only once
        console.log('initializeApp: Data already loaded. Skipping.');
        return;
    }

    console.log('initializeApp: Starting data and settings loading.');

    try {
        // In Tauri, call the Rust backend's init_db command to ensure database tables are created and default data is inserted
        // await invoke('init_db');
        console.log('initializeApp: SQLite database initialized.');

        const settings = await sqlite.getSettingFromDB()

        for (const item of settings) {
            if (item.key_name === 'firstTime') {
                if (item.value) {
                    showScreen(homeScreen); // Show home page if not first time
                } else {
                    await sqlite.saveSettingToDB('firstTime', 'false'); // Save setting
                    showScreen(tutorialScreen); // Show tutorial for the first time
                }
            } else if (item.key_name === 'gamesPlayed') {
                gamesPlayed = parseInt(item.value, 10);
            } else if (item.key_name === 'highScore') {
                highScore = parseInt(item.value, 10);
            } else if (item.key_name === 'pairCount') {
                pairCount = parseInt(item.value, 10);
            }
        }

        dataLoaded = true; // Mark data as loaded

        await reloadWordList(); // Load words

        console.log('initializeApp: Data and settings loaded.');
    } catch (err) {
        console.error('initializeApp: Error loading data and settings:', err);
        displayMessage('加载应用数据失败。请尝试重新启动应用。', 'error');
    }
}

async function savePairCountSetting() {
    pairCount = parseInt(customPairCountInput.value, 10);
    if (isNaN(pairCount) || pairCount < 4) {
        pairCount = 4;
    } else if (pairCount > 50) {
        pairCount = 50;
    }
    customPairCountInput.value = pairCount; // Ensure input reflects the clamped value
    await sqlite.saveSettingToDB('pairCount', pairCount.toString());
    displayMessage(`每局单词对数已设置为 ${pairCount} 对。`, 'success', '设置已保存');
}

// --- Single Player Game Logic ---
function initGame() {
    if (!dataLoaded) { // Check if data is loaded
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
    selectedEnglishCard = null;
    selectedChineseCard = null;
    clearInterval(timerInterval);
    timer = 0;
    timeDisplay.textContent = timer;
    scoreDisplay.textContent = score;

    // Select random pairs for the game
    const shuffledWordPairs = [...wordPairs].sort(() => 0.5 - Math.random());
    currentCards = shuffledWordPairs.slice(0, pairCount); // Only need the pairs

    renderSinglePlayerGameCards(currentCards);
    showScreen(gameScreen);

    gamesPlayed++;
    sqlite.saveSettingToDB('gamesPlayed', gamesPlayed); // Save updated gamesPlayed
    updateStats(); // Update stats on home screen after game starts

    timerInterval = setInterval(() => {
        timer++;
        timeDisplay.textContent = timer;
    }, 1000);
    console.log('Single player game initialized.');
}

function renderSinglePlayerGameCards(pairs) {
    englishColumn.innerHTML = '';
    chineseColumn.innerHTML = '';

    const englishWords = pairs.map(pair => ({value: pair.english, match: pair.chinese}));
    const chineseWords = pairs.map(pair => ({value: pair.chinese, match: pair.english}));

    // Shuffle independently for display
    englishWords.sort(() => 0.5 - Math.random());
    chineseWords.sort(() => 0.5 - Math.random());

    englishWords.forEach(cardData => {
        const card = createCardElement(cardData.value, 'english', cardData.match, 'single');
        englishColumn.appendChild(card);
    });

    chineseWords.forEach(cardData => {
        const card = createCardElement(cardData.value, 'chinese', cardData.match, 'single');
        chineseColumn.appendChild(card);
    });
}

// Function to create a card element
function createCardElement(value, type, match, gameType, playerNum = null) {
    const card = document.createElement('div');
    card.classList.add('card');
    card.dataset.type = type;
    card.dataset.value = value;
    card.dataset.match = match;
    if (playerNum) {
        card.dataset.player = playerNum;
    }

    card.textContent = value; // Directly display the word/meaning

    if (gameType === 'single') {
        card.addEventListener('click', () => handleSinglePlayerCardClick(card));
    } else if (gameType === 'twoPlayer') {
        card.addEventListener('click', () => handleTwoPlayerCardClick(card));
    }
    return card;
}

function handleSinglePlayerCardClick(cardElement) {
    if (cardElement.classList.contains('matched')) {
        return; // Already matched
    }

    const cardType = cardElement.dataset.type;

    // Remove 'selected' from previously selected card of the same type
    if (cardType === 'english') {
        if (selectedEnglishCard) {
            selectedEnglishCard.classList.remove('selected');
        }
        selectedEnglishCard = cardElement;
    } else { // chinese
        if (selectedChineseCard) {
            selectedChineseCard.classList.remove('selected');
        }
        selectedChineseCard = cardElement;
    }

    cardElement.classList.add('selected');

    // Check for match if both English and Chinese cards are selected
    if (selectedEnglishCard && selectedChineseCard) {
        checkSinglePlayerMatch();
    }
}

function checkSinglePlayerMatch() {
    const englishValue = selectedEnglishCard.dataset.value;
    const chineseValue = selectedChineseCard.dataset.value;

    // Check if values match correctly (e.g., english matches chinese, and chinese matches english)
    const isMatch = wordPairs.some(pair =>
        pair.english === englishValue && pair.chinese === chineseValue
    );

    if (isMatch) {
        // Match found
        selectedEnglishCard.classList.add('matched');
        selectedChineseCard.classList.add('matched');
        // Visually remove cards after a short delay
        setTimeout(() => {
            selectedEnglishCard.remove();
            selectedChineseCard.remove();
        }, 300); // Quick fade out

        matchedPairs++;
        score += 10;
        scoreDisplay.textContent = score;

        if (matchedPairs === pairCount) {
            clearInterval(timerInterval);
            displayMessage(`恭喜！您在 ${timer} 秒内完成了游戏！您的得分是 ${score}！`, 'success', '游戏结束');
            if (score > highScore) {
                highScore = score;
                sqlite.saveSettingToDB('highScore', highScore); // Save updated high score
                displayMessage(`恭喜！您打破了最高分记录！新最高分是 ${highScore}！`, 'success', '新纪录！');
            }
            updateStats(); // Update stats on home screen after game ends
        }
    } else {
        // No match, deselect
        score = Math.max(0, score - 2); // Deduct points for incorrect match
        scoreDisplay.textContent = score;
        displayMessage(`不匹配！${englishValue} 和 ${chineseValue} 不是一对。`, 'error');

        setTimeout(() => {
            selectedEnglishCard.classList.remove('selected');
            selectedChineseCard.classList.remove('selected');
        }, 500); // Allow some time to see the cards before deselecting
    }
    selectedEnglishCard = null; // Reset selected cards
    selectedChineseCard = null;
}

// --- Two-Player Game Logic ---
function initTwoPlayerGame() {
    if (!dataLoaded) { // Check if data is loaded
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

    const totalGamePairs = pairCount; // Total pairs for the game
    player1TotalPairs = totalGamePairs;
    player2TotalPairs = totalGamePairs;

    const shuffledPairs = [...wordPairs].sort(() => 0.5 - Math.random()).slice(0, totalGamePairs);

    renderTwoPlayerGameCards(shuffledPairs);

    showScreen(twoPlayerGameScreen);

    gamesPlayed++;
    sqlite.saveSettingToDB('gamesPlayed', gamesPlayed);
    updateStats();
    console.log('Two player game initialized.');
}

function renderTwoPlayerGameCards(pairs) {
    player1EnglishColumn.innerHTML = '';
    player1ChineseColumn.innerHTML = '';
    player2EnglishColumn.innerHTML = '';
    player2ChineseColumn.innerHTML = '';

    const player1EnglishWords = pairs.map(pair => ({value: pair.english, match: pair.chinese}));
    const player1ChineseWords = pairs.map(pair => ({value: pair.chinese, match: pair.english}));
    player1EnglishWords.sort(() => 0.5 - Math.random());
    player1ChineseWords.sort(() => 0.5 - Math.random());

    player1EnglishWords.forEach(cardData => {
        const card = createCardElement(cardData.value, 'english', cardData.match, 'twoPlayer', 1);
        player1EnglishColumn.appendChild(card);
    });
    player1ChineseWords.forEach(cardData => {
        const card = createCardElement(cardData.value, 'chinese', cardData.match, 'twoPlayer', 1);
        player1ChineseColumn.appendChild(card);
    });

    // Player 2 uses the same set of words but rendered independently
    const player2EnglishWords = pairs.map(pair => ({value: pair.english, match: pair.chinese}));
    const player2ChineseWords = pairs.map(pair => ({value: pair.chinese, match: pair.english}));
    player2EnglishWords.sort(() => 0.5 - Math.random());
    player2ChineseWords.sort(() => 0.5 - Math.random());

    player2EnglishWords.forEach(cardData => {
        const card = createCardElement(cardData.value, 'english', cardData.match, 'twoPlayer', 2);
        player2EnglishColumn.appendChild(card);
    });
    player2ChineseWords.forEach(cardData => {
        const card = createCardElement(cardData.value, 'chinese', cardData.match, 'twoPlayer', 2);
        player2ChineseColumn.appendChild(card);
    });
}


// Central handler for two-player card clicks
function handleTwoPlayerCardClick(cardElement) {
    if (cardElement.classList.contains('matched')) {
        return; // Already matched
    }

    const player = parseInt(cardElement.dataset.player);
    const cardType = cardElement.dataset.type;

    if (player === 1) {
        if (cardType === 'english') {
            if (player1SelectedEnglishCard) player1SelectedEnglishCard.classList.remove('selected');
            player1SelectedEnglishCard = cardElement;
        } else { // chinese
            if (player1SelectedChineseCard) player1SelectedChineseCard.classList.remove('selected');
            player1SelectedChineseCard = cardElement;
        }
        cardElement.classList.add('selected');

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
        cardElement.classList.add('selected');

        // Check for match if both English and Chinese cards are selected for Player 2
        if (player2SelectedEnglishCard && player2SelectedChineseCard) {
            checkTwoPlayerMatch(player2SelectedEnglishCard, player2SelectedChineseCard, 2);
        }
    }
}

function checkTwoPlayerMatch(englishCardElement, chineseCardElement, playerNum) {
    const englishWord = englishCardElement.dataset.value; // Get content directly
    const chineseWord = chineseCardElement.dataset.value;

    // wordPairs is a global variable, fetched from Rust backend via loadWordsFromDB
    const isMatch = wordPairs.some(pair =>
        pair.english === englishWord && pair.chinese === chineseWord
    );

    let message = '';
    if (isMatch) {
        englishCardElement.classList.add('matched');
        chineseCardElement.classList.add('matched');
        englishCardElement.classList.remove('selected');
        chineseCardElement.classList.remove('selected');

        // Visually remove cards after a short delay
        setTimeout(() => {
            englishCardElement.remove();
            chineseCardElement.remove();
        }, 300);

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


// --- Event Listeners for buttons ---
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

document.getElementById('addWordBtn').addEventListener('click', (event) => {
    const englishToEdit = document.getElementById('englishWord').value;
    const chineseToEdit = document.getElementById('chineseMeaning').value;

    if (englishToEdit && chineseToEdit) {
        sqlite.saveWordToDB(englishToEdit, chineseToEdit).then(() => {
            reloadWordList();
        });
    } else {
        displayMessage('单词或中文不能为空，请检查输入。', 'error');
    }
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

// Word pair count settings event
if (pairCountSelect && customPairCountInput) {
    pairCountSelect.addEventListener('change', () => {
        customPairCountInput.value = pairCountSelect.value;
        savePairCountSetting();
    });

    customPairCountInput.addEventListener('change', () => {
        const value = parseInt(customPairCountInput.value, 10); // Corrected ID
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

    tauri.path.resolve('.').then(path => {
        tauri.path.join(path, filename).then(result => {
            console.log('SQLite database path:', result);

            Database.load(`sqlite:${result}`).then((db) => {
                sqlite = new SQLiteHandler(db);

                initializeApp();
            });
        });
    });
});
