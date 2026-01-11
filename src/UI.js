/**
 * UI Manager
 * Manages HUD, help menu, and game controls
 */

export class UIManager {
    constructor() {
        // HUD elements
        this.scoreDisplay = document.getElementById('score-value');
        this.timerDisplay = document.getElementById('timer-value');
        this.survivalDisplay = document.getElementById('survival-value');
        
        // Help menu
        this.helpMenu = document.getElementById('help-menu');
        this.isHelpVisible = false;
        
        // UI Panel (will be shown during preparation phase)
        this.uiPanel = document.getElementById('ui-panel');
        
        // Game controls
        this.startButton = document.getElementById('start-simulation');
        this.restartButton = document.getElementById('restart-level');
    }
    
    init = (gameState) => {
        // Setup button event listeners
        this.startButton.addEventListener('click', () => {
            gameState.startSimulation();
        });
        
        this.restartButton.addEventListener('click', () => {
            gameState.restartLevel();
        });
    }
    
    toggleHelp = () => {
        this.isHelpVisible = !this.isHelpVisible;
        
        if (this.isHelpVisible) {
            this.helpMenu.classList.remove('hidden');
        } else {
            this.helpMenu.classList.add('hidden');
        }
    }
    
    update = (gameState) => {
        // Update score
        this.scoreDisplay.textContent = Math.floor(gameState.score);
        
        // Color-code score
        if (gameState.score >= 70) {
            this.scoreDisplay.classList.add('winning');
            this.scoreDisplay.classList.remove('danger');
        } else {
            this.scoreDisplay.classList.add('danger');
            this.scoreDisplay.classList.remove('winning');
        }
        
        // Update timer
        this.timerDisplay.textContent = gameState.timeRemaining.toFixed(1);
        
        // Warning color for low time
        if (gameState.timeRemaining < 5) {
            this.timerDisplay.classList.add('warning');
        } else {
            this.timerDisplay.classList.remove('warning');
        }
        
        // Update survival percentage
        const aliveCount = gameState.fishAlive;
        const totalCount = gameState.fishTotal;
        const percentage = totalCount > 0 ? ((aliveCount / totalCount) * 100).toFixed(0) : 100;
        this.survivalDisplay.textContent = `Alive: ${aliveCount}/${totalCount} (${percentage}%)`;
    }
}
