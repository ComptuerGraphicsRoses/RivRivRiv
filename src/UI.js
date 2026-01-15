
export class UIManager {
    constructor() {
        this.scoreDisplay = document.getElementById('score-value');
        this.timerDisplay = document.getElementById('timer-value');
        this.survivalDisplay = document.getElementById('survival-value');

        this.helpMenu = document.getElementById('help-menu');
        this.isHelpVisible = false;

        this.uiPanel = document.getElementById('ui-panel');

        this.startButton = document.getElementById('start-simulation');
        this.restartButton = document.getElementById('restart-level');

        this.gameEndPopup = document.getElementById('game-end-popup');
        this.popupTitle = document.getElementById('popup-title');
        this.popupScore = document.getElementById('popup-score');
        this.popupSaved = document.getElementById('popup-saved');
        this.popupSurvival = document.getElementById('popup-survival');
        this.popupRequired = document.getElementById('popup-required');
        this.popupMessage = document.getElementById('popup-message');
        this.popupRestartBtn = document.getElementById('popup-restart');
        this.popupNextBtn = document.getElementById('popup-next');

        this.inventoryHotbar = document.getElementById('inventory-hotbar');
        this.inventorySlotsContainer = document.getElementById('inventory-slots');

        this.itemMetadata = {
            rock1: { name: 'Small Rock', icon: '🪨', keybind: '3' },
            rock2: { name: 'Big Rock', icon: '🗿', keybind: '4' },
            rock3: { name: 'Large Coral', icon: '🪸', keybind: '5' },
            bait: { name: 'Bait', icon: '🪝', keybind: '6' },
            spotlight: { name: 'Spotlight', icon: '💡', keybind: '7' }
        };
    }

    init = (gameState) => {
        this.startButton.addEventListener('click', () => {
            gameState.startSimulation();
        });

        this.restartButton.addEventListener('click', () => {
            this.hideGameEndPopup();
            gameState.restartLevel();
        });
    }

    initInventory = (inventoryManager) => {
        this.inventoryManager = inventoryManager;
        this.renderInventoryHotbar();
    }

    renderInventoryHotbar = () => {
        if (!this.inventoryManager) return;

        this.inventorySlotsContainer.innerHTML = '';

        const status = this.inventoryManager.getInventoryStatus();

        for (const [itemType, itemStatus] of Object.entries(status)) {
            const metadata = this.itemMetadata[itemType];
            if (!metadata) continue;

            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            slot.dataset.itemType = itemType;

            const keybind = document.createElement('div');
            keybind.className = 'keybind';
            keybind.textContent = metadata.keybind;
            slot.appendChild(keybind);

            const icon = document.createElement('div');
            icon.className = 'item-icon';
            icon.textContent = metadata.icon;
            slot.appendChild(icon);

            const name = document.createElement('div');
            name.className = 'item-name';
            name.textContent = metadata.name;
            slot.appendChild(name);

            const count = document.createElement('div');
            count.className = 'item-count';
            count.textContent = `${itemStatus.remaining}/${itemStatus.limit}`;
            slot.appendChild(count);

            if (itemStatus.remaining === 0) {
                slot.classList.add('depleted');
                count.classList.add('depleted');
            } else if (itemStatus.remaining <= Math.ceil(itemStatus.limit / 3)) {
                count.classList.add('low');
            }

            this.inventorySlotsContainer.appendChild(slot);
        }
    }

    updateInventory = () => {
        if (!this.inventoryManager) return;

        const status = this.inventoryManager.getInventoryStatus();

        for (const [itemType, itemStatus] of Object.entries(status)) {
            const slot = this.inventorySlotsContainer.querySelector(`[data-item-type="${itemType}"]`);
            if (!slot) continue;

            const countElement = slot.querySelector('.item-count');
            if (countElement) {
                countElement.textContent = `${itemStatus.remaining}/${itemStatus.limit}`;

                countElement.classList.remove('low', 'depleted');
                slot.classList.remove('depleted');

                if (itemStatus.remaining === 0) {
                    slot.classList.add('depleted');
                    countElement.classList.add('depleted');
                } else if (itemStatus.remaining <= Math.ceil(itemStatus.limit / 3)) {
                    countElement.classList.add('low');
                }
            }
        }
    }

    toggleHelp = () => {
        this.isHelpVisible = !this.isHelpVisible;

        if (this.isHelpVisible) {
            this.helpMenu.classList.remove('hidden');
        } else {
            this.helpMenu.classList.add('hidden');
        }
    }

    showGameEndPopup = (gameState, isWin, hasNextLevel = true) => {
        this.gameEndPopup.classList.remove('win', 'lose');
        this.gameEndPopup.classList.add(isWin ? 'win' : 'lose');

        this.popupTitle.textContent = isWin ? '🎉 Level Complete!' : '💀 Level Failed';

        this.popupScore.textContent = Math.floor(gameState.score);
        this.popupSaved.textContent = `${gameState.fishSaved}/${gameState.fishTotal}`;

        const survivalRate = gameState.fishTotal > 0
            ? ((gameState.fishSaved / gameState.fishTotal) * 100).toFixed(1)
            : 0;
        this.popupSurvival.textContent = `${survivalRate}%`;
        this.popupRequired.textContent = `${(gameState.requiredSurvivalPercentage * 100).toFixed(0)}%`;

        if (isWin) {
            this.popupMessage.textContent = 'Great job guiding the fish to safety! Ready for the next challenge?';
        } else {
            this.popupMessage.textContent = `Not enough fish survived. You needed ${(gameState.requiredSurvivalPercentage * 100).toFixed(0)}% survival rate. Try again!`;
        }

        if (isWin && hasNextLevel) {
            this.popupNextBtn.disabled = false;
            this.popupNextBtn.textContent = 'Next Level';
        } else if (isWin && !hasNextLevel) {
            this.popupNextBtn.disabled = true;
            this.popupNextBtn.textContent = 'All Levels Complete!';
            this.popupMessage.textContent = '🏆 Congratulations! You completed all levels! You are a true fish guardian!';
        } else {
            this.popupNextBtn.disabled = true;
            this.popupNextBtn.textContent = 'Next Level';
        }

        this.gameEndPopup.classList.remove('hidden');
    }

    hideGameEndPopup = () => {
        this.gameEndPopup.classList.add('hidden');
    }

    update = (gameState) => {
        this.scoreDisplay.textContent = Math.floor(gameState.score);

        if (gameState.score >= 70) {
            this.scoreDisplay.classList.add('winning');
            this.scoreDisplay.classList.remove('danger');
        } else {
            this.scoreDisplay.classList.add('danger');
            this.scoreDisplay.classList.remove('winning');
        }

        this.timerDisplay.textContent = gameState.timeRemaining.toFixed(1);

        if (gameState.timeRemaining < 5) {
            this.timerDisplay.classList.add('warning');
        } else {
            this.timerDisplay.classList.remove('warning');
        }

        const aliveCount = gameState.fishAlive;
        const savedCount = gameState.fishSaved;
        const totalCount = gameState.fishTotal;
        const percentage = totalCount > 0 ? ((savedCount / totalCount) * 100).toFixed(0) : 100;
        this.survivalDisplay.textContent = `Alive: ${aliveCount}/${totalCount} | Saved: ${savedCount} (${percentage}%)`;

        this.updateInventory();

        if (gameState.phase === 'PREPARATION') {
            const canStart = gameState.canStartGame();
            this.startButton.disabled = !canStart;

            if (!canStart) {
                this.startButton.textContent = 'Place All Items First!';
                this.startButton.style.cursor = 'not-allowed';
            } else {
                this.startButton.textContent = 'Start Simulation';
                this.startButton.style.cursor = 'pointer';
            }
        } else if (gameState.phase === 'SIMULATION') {
            this.startButton.disabled = true;
            this.startButton.textContent = 'Simulation Running...';
        } else if (gameState.phase === 'EVALUATION') {
            this.startButton.disabled = true;
            this.startButton.textContent = 'Level Complete';
        }

        if (this.inventoryHotbar) {
            if (gameState.phase === 'PREPARATION') {
                this.inventoryHotbar.style.display = 'block';
            } else {
                this.inventoryHotbar.style.display = 'none';
            }
        }
    }
}