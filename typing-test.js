// ============================================
// 타자 검정 게임 - 메인 로직
// 문장 데이터베이스
// ============================================
const SENTENCES = [
    "안녕하세요 저는 세명컴고에 재학중입니다",
    "저희가 배우는 것은 프로그래밍 입니다.",
    "타이핑 속도를 높이려면 꾸준한 연습이 필요합니다",
    "신속하고 정확한 입력이 무엇보다 중요합니다",
    "컴퓨터 과학은 현대 사회에서 필수적인 학문입니다",
    "코딩을 배우는 것은 문제 해결 능력을 기르는 것입니다",
    "성공은 노력과 인내의 결과입니다",
    "독서는 지식을 넓히는 가장 좋은 방법입니다",
    "운동은 건강한 몸과 마음을 만듭니다",
    "음악은 감성을 풍부하게 만들어 줍니다",
    "여행은 새로운 경험과 추억을 선사합니다",
    "친구들과의 관계는 소중한 인생의 자산입니다",
    "배움에는 끝이 없고 시작만 있습니다",
    "오늘의 노력이 내일의 성과가 됩니다",
    "인내와 끈기로 어떤 목표도 달성할 수 있습니다"
];

// ============================================
// 게임 상태 변수
// ============================================
let gameState = 'idle';        // 'idle', 'playing', 'finished'
let timeRemaining = 60;        // 남은 시간 (초)
let currentScore = 0;          // 현재 점수
let totalChars = 0;            // 총 입력한 글자 수
let correctChars = 0;          // 정확하게 입력한 글자 수
let mistakes = 0;              // 오타 횟수
let currentSentence = '';      // 현재 문장
let userInput = '';            // 사용자 입력
let timerInterval = null;      // 타이머 인터벌 ID
let gameTime = 60;             // 게임 시간 설정 (초)
let currentSentenceIndex = 0;  // 현재 문장 인덱스
let currentCorrectChars = 0;  // 현재 문장에서 맞게 입력한 글자 수

// ============================================
// DOM 요소 참조
// ============================================
const elements = {
    timeDisplay: document.getElementById('timeDisplay'),
    scoreDisplay: document.getElementById('scoreDisplay'),
    accuracyDisplay: document.getElementById('accuracyDisplay'),
    sentenceDisplay: document.getElementById('sentenceDisplay'),
    sentenceProgress: document.getElementById('sentenceProgress'),
    userInput: document.getElementById('userInput'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    startBtn: document.getElementById('startBtn'),
    resetBtn: document.getElementById('resetBtn'),
    resultModal: document.getElementById('resultModal'),
    finalScore: document.getElementById('finalScore'),
    finalAccuracy: document.getElementById('finalAccuracy'),
    finalChars: document.getElementById('finalChars'),
    finalMistakes: document.getElementById('finalMistakes'),
    closeModalBtn: document.getElementById('closeModalBtn')
};

// ============================================
// 게임 초기화
// ============================================
function initGame() {
    console.log('게임 초기화');
    
    // 이벤트 리스너 등록
    elements.startBtn.addEventListener('click', startGame);
    elements.resetBtn.addEventListener('click', resetGame);
    elements.closeModalBtn.addEventListener('click', closeResultModal);
    elements.userInput.addEventListener('input', handleInput);
    elements.userInput.addEventListener('keydown', handleKeydown);
    
    // 초기 상태 설정
    resetGame();
}

// ============================================
// 게임 시작
// ============================================
function startGame() {
    console.log('게임 시작');
    
    if (gameState === 'playing') return;
    
    gameState = 'playing';
    
    // 초기화
    currentScore = 0;
    totalChars = 0;
    correctChars = 0;
    mistakes = 0;
    timeRemaining = gameTime;
    currentSentenceIndex = 0;  // 문장 인덱스 초기화
    currentCorrectChars = 0;  // 현재 문장 정확한 글자 수 초기화
    
    // 첫 번째 문장 선택
    currentSentence = selectNextSentence();
    displaySentence(currentSentence);
    
    // UI 업데이트
    elements.startBtn.disabled = true;
    elements.resetBtn.disabled = true;
    elements.userInput.disabled = false;
    elements.userInput.value = '';
    elements.userInput.focus();
    
    // 타이머 시작
    startTimer();
    
    // 문장 진행 상황 표시
    elements.sentenceProgress.textContent = `문장 1 / ${SENTENCES.length}`;
    
    // 화면 업데이트
    updateDisplay();
}

// ============================================
// 게임 종료
// ============================================
function endGame() {
    console.log('게임 종료');
    
    if (gameState !== 'playing') return;
    
    gameState = 'finished';
    
    // 타이머 정지
    clearInterval(timerInterval);
    
    // 시간 보너스 계산 및 추가
    const timeBonus = timeRemaining * 5;
    if (timeBonus > 0) {
        currentScore += timeBonus;
    }
    
    // 정확도 100% 보너스
    const accuracy = calculateAccuracy();
    if (accuracy === 100 && totalChars > 0) {
        currentScore += 500;
    }
    
    // UI 비활성화
    elements.userInput.disabled = true;
    elements.startBtn.disabled = true;
    elements.resetBtn.disabled = false;
    
    // 결과 저장
    const result = saveScore(currentScore, accuracy);
    console.log('점수 저장:', result);
    
    // 결과 화면 표시
    showResult();
}

// ============================================
// 게임 리셋
// ============================================
function resetGame() {
    console.log('게임 리셋');
    
    // 상태 초기화
    gameState = 'idle';
    timeRemaining = gameTime;
    currentScore = 0;
    totalChars = 0;
    correctChars = 0;
    mistakes = 0;
    currentSentence = '';
    userInput = '';
    currentSentenceIndex = 0;
    currentCorrectChars = 0;
    
    // 타이머 정지
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    // UI 초기화
    elements.sentenceDisplay.textContent = '게임을 시작하려면 "시작" 버튼을 누르세요.';
    elements.sentenceProgress.textContent = `문장 0 / ${SENTENCES.length}`;
    elements.userInput.value = '';
    elements.userInput.disabled = true;
    elements.startBtn.disabled = false;
    elements.resetBtn.disabled = true;
    elements.progressFill.style.width = '0%';
    elements.progressText.textContent = '입력 진행: 0 / 0';
    
    // 화면 업데이트
    updateDisplay();
}

// ============================================
// 다음 문장 선택 (순서대로)
// ============================================
function selectNextSentence() {
    // 모든 문장을 다 썼는지 확인
    if (currentSentenceIndex >= SENTENCES.length) {
        return null; // 더 이상 문장이 없음
    }
    
    return SENTENCES[currentSentenceIndex];
}

// ============================================
// 문장 표시 (HTML 렌더링)
// ============================================
function displaySentence(sentence) {
    const chars = sentence.split('');
    let html = '';
    
    chars.forEach((char, index) => {
        // 띄어쓰기 처리 (공백을 더 눈에 띄게 표시)
        if (char === ' ') {
            if (index === 0) {
                html += `<span class="current space">·</span>`;
            } else {
                html += `<span class="space">·</span>`;
            }
        } else {
            if (index === 0) {
                html += `<span class="current">${char}</span>`;
            } else {
                html += `<span>${char}</span>`;
            }
        }
    });
    
    elements.sentenceDisplay.innerHTML = html;
}

// ============================================
// 타이머 시작
// ============================================
function startTimer() {
    updateTimer(); // 즉시 업데이트
    
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimer();
        
        if (timeRemaining <= 0) {
            endGame();
        }
    }, 1000);
}

// ============================================
// 타이머 업데이트
// ============================================
function updateTimer() {
    elements.timeDisplay.textContent = `${timeRemaining}초`;
    
    // 시간이 10초 이하일 때 경고 효과 (JS로 애니메이션)
    if (timeRemaining <= 10 && timeRemaining > 0) {
        animateElement(elements.timeDisplay, 'pulse');
    }
}

// ============================================
// 요소 애니메이션 처리 (JS만 사용)
// ============================================
function animateElement(element, effectType) {
    if (effectType === 'pulse') {
        let scale = 1;
        const interval = setInterval(() => {
            scale = scale === 1 ? 1.1 : 1;
            element.style.transform = `scale(${scale})`;
            element.style.transition = 'transform 0.3s ease';
        }, 300);
        
        setTimeout(() => {
            clearInterval(interval);
            element.style.transform = 'scale(1)';
        }, 1500);
    }
}

// ============================================
// 사용자 입력 처리
// ============================================
function handleInput(event) {
    if (gameState !== 'playing') return;
    
    const input = event.target.value;
    const sentenceLength = currentSentence.length;
    
    // 입력 글자 수가 문장 길이를 초과하면 막기
    if (input.length > sentenceLength) {
        elements.userInput.value = input.substring(0, sentenceLength);
        return;
    }
    
    checkInput(input);
    updateSentenceDisplay(input);
    updateProgress(input);
    updateDisplay();
    
    // 자동으로 넘어가지 않음 - Enter 키를 눌러야 함
}

// ============================================
// 키보드 이벤트 처리
// ============================================
function handleKeydown(event) {
    if (gameState !== 'playing') return;
    
    // Enter 키로 문장 완성 및 다음 문장으로 이동
    if (event.key === 'Enter') {
        event.preventDefault();
        
        const inputValue = elements.userInput.value;
        
        // 문장을 다 쓰지 않았으면 넘어가지 않음
        if (inputValue.length < currentSentence.length) {
            return;
        }
        
        // 점수 계산하고 다음 문장으로 이동
        completeSentence();
    }
}

// ============================================
// 입력 검사 (실시간 추적, 오타 판정은 Enter 시)
// ============================================
function checkInput(input) {
    // 실시간으로 맞는 글자 수만 계산 (오타는 Enter 시에만 판정)
    currentCorrectChars = 0;
    for (let i = 0; i < input.length; i++) {
        if (input[i] === currentSentence[i]) {
            currentCorrectChars++;
        }
    }
    
    userInput = input;
}

// ============================================
// 문장 표시 업데이트 (입력에 따라 하이라이트)
// ============================================
function updateSentenceDisplay(input) {
    const chars = currentSentence.split('');
    let html = '';
    
    chars.forEach((char, index) => {
        let className = '';
        
        if (index < input.length) {
            if (char === input[index]) {
                className = 'correct';
            } else {
                className = 'incorrect';
            }
        } else if (index === input.length) {
            className = 'current';
        }
        
        // 띄어쓰기 처리 (공백을 더 눈에 띄게 표시)
        if (char === ' ') {
            html += `<span class="${className} space">·</span>`;
        } else {
            html += `<span class="${className}">${char}</span>`;
        }
    });
    
    elements.sentenceDisplay.innerHTML = html;
}

// ============================================
// 진행 상황 업데이트
// ============================================
function updateProgress(input) {
    const progress = (input.length / currentSentence.length) * 100;
    elements.progressFill.style.width = `${progress}%`;
    elements.progressText.textContent = `입력 진행: ${input.length} / ${currentSentence.length}`;
}

// ============================================
// 문장 완성 처리 (Enter 키 눌렀을 때)
// ============================================
function completeSentence() {
    const inputValue = elements.userInput.value;
    
    // Enter를 눌렀을 때 오타 판정
    const sentenceLength = currentSentence.length;
    let sentenceMistakes = 0;
    
    for (let i = 0; i < sentenceLength; i++) {
        if (i < inputValue.length) {
            if (inputValue[i] !== currentSentence[i]) {
                sentenceMistakes++;
            }
        } else {
            sentenceMistakes++; // 덜 쓴 글자도 오타로 판정
        }
    }
    
    // 점수 계산 (먼저 추가)
    const sentenceScore = sentenceLength * 10;
    currentScore += sentenceScore;
    
    // 오타에 따른 대폭 점수 차감
    if (sentenceMistakes > 0) {
        // 오타당 큰 페널티: 오타가 많을수록 점수 차감 폭이 큼
        const penalty = sentenceMistakes * 20; // 오타당 -20점
        const bonusPenalty = sentenceMistakes * 10; // 추가 페널티
        currentScore = Math.max(0, currentScore - penalty - bonusPenalty);
        mistakes += sentenceMistakes;
    }
    
    // 총 글자 수와 정확한 글자 수 추가
    totalChars += sentenceLength;
    correctChars += (sentenceLength - sentenceMistakes);
    
    // 정확도 100% 체크
    const isPerfect = (sentenceMistakes === 0);
    
    // 정확도 보너스 (오타가 없을 때만)
    if (isPerfect) {
        currentScore += 50; // 완벽한 문장 보너스
    }
    
    // 현재 문장 통계 초기화
    currentCorrectChars = 0;
    
    // 화면 업데이트
    updateDisplay();
    
    // 다음 문장으로 넘어가기
    nextSentence();
}

// ============================================
// 다음 문장으로 이동
// ============================================
function nextSentence() {
    // 다음 문장 인덱스로 이동
    currentSentenceIndex++;
    
    // 문장 진행 상황 업데이트
    elements.sentenceProgress.textContent = `문장 ${currentSentenceIndex + 1} / ${SENTENCES.length}`;
    
    // 작은 딜레이 후 다음 문장 표시
    setTimeout(() => {
        // 더 이상 문장이 없으면 게임 종료
        if (currentSentenceIndex >= SENTENCES.length) {
            endGame();
            return;
        }
        
        currentSentence = selectNextSentence();
        displaySentence(currentSentence);
        elements.userInput.value = '';
        userInput = '';
        currentCorrectChars = 0;
        updateProgress('');
        elements.userInput.focus();
    }, 300);
}

// ============================================
// 점수 계산
// ============================================
function calculateScore(chars, mistakes) {
    return (chars * 10) - (mistakes * 5);
}

// ============================================
// 정확도 계산
// ============================================
function calculateAccuracy() {
    // 게임 진행 중이고 입력이 있으면 현재 입력까지 포함해서 계산
    if (gameState === 'playing' && userInput.length > 0) {
        const currentTotal = totalChars + userInput.length;
        const currentCorrect = correctChars + currentCorrectChars;
        return Math.round((currentCorrect / currentTotal) * 100);
    }
    
    // 게임이 끝났거나 입력이 없으면 완료된 문장들만 계산
    if (totalChars === 0) return 0;
    return Math.round((correctChars / totalChars) * 100);
}

// ============================================
// 화면 업데이트
// ============================================
function updateDisplay() {
    elements.scoreDisplay.textContent = `${currentScore}점`;
    
    const accuracy = calculateAccuracy();
    elements.accuracyDisplay.textContent = `${accuracy}%`;
}

// ============================================
// 점수 저장 (향후 온라인 랭킹 시스템 연동용)
// ============================================
function saveScore(score, accuracy) {
    const scoreData = {
        score: score,
        accuracy: accuracy,
        totalChars: totalChars,
        correctChars: correctChars,
        mistakes: mistakes,
        timestamp: new Date().toISOString(),
        gameTime: gameTime,
        timeRemaining: timeRemaining
    };
    
    // 로컬 스토리지에 저장 (선택적)
    try {
        const existingScores = JSON.parse(localStorage.getItem('typingTestScores') || '[]');
        existingScores.push(scoreData);
        
        // 최근 10개만 저장
        const recentScores = existingScores.slice(-10);
        localStorage.setItem('typingTestScores', JSON.stringify(recentScores));
    } catch (error) {
        console.error('점수 저장 실패:', error);
    }
    
    return scoreData;
}

// ============================================
// 점수 조회 (로컬 스토리지에서)
// ============================================
function getSavedScores() {
    try {
        return JSON.parse(localStorage.getItem('typingTestScores') || '[]');
    } catch (error) {
        console.error('점수 조회 실패:', error);
        return [];
    }
}

// ============================================
// 결과 화면 표시
// ============================================
function showResult() {
    const accuracy = calculateAccuracy();
    
    elements.finalScore.textContent = `${currentScore}점`;
    elements.finalAccuracy.textContent = `${accuracy}%`;
    elements.finalChars.textContent = `${totalChars}자`;
    elements.finalMistakes.textContent = `${mistakes}회`;
    
    elements.resultModal.classList.add('show');
}

// ============================================
// 결과 모달 닫기
// ============================================
function closeResultModal() {
    elements.resultModal.classList.remove('show');
}

// ============================================
// 게임 초기화 실행
// ============================================
// DOM이 로드된 후 실행
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}

// 디버깅용: 콘솔에서 점수 확인
console.log('타자 검정 게임이 로드되었습니다.');
console.log('이전 기록:', getSavedScores());
