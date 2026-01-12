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

        // Inventory hotbar
        this.inventoryHotbar = document.getElementById('inventory-hotbar');
        this.inventorySlotsContainer = document.getElementById('inventory-slots');

        // Item metadata for display
        this.itemMetadata = {
            rock1: { name: 'Small Rock', icon: '🪨', keybind: '3' },
            rock2: { name: 'Spiky Rock', icon: '💀', keybind: '4' },
            rock3: { name: 'Large Rock', icon: '⛰️', keybind: '5' },
            bait: { name: 'Bait', icon: '🪝', keybind: '6' },
            spotlight: { name: 'Spotlight', icon: '💡', keybind: '7' }
        };
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
    
    /**
     * Initialize inventory hotbar with items from inventory manager
     * @param {InventoryManager} inventoryManager - The inventory manager instance
     */
    initInventory = (inventoryManager) => {
        this.inventoryManager = inventoryManager;
        this.renderInventoryHotbar();
    }

    /**
     * Render the inventory hotbar with all items
     */
    renderInventoryHotbar = () => {
        if (!this.inventoryManager) return;

        // Clear existing slots
        this.inventorySlotsContainer.innerHTML = '';

        // Get inventory status
        const status = this.inventoryManager.getInventoryStatus();

        // Create slots for each item type
        for (const [itemType, itemStatus] of Object.entries(status)) {
            const metadata = this.itemMetadata[itemType];
            if (!metadata) continue;

            // Create slot element
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            slot.dataset.itemType = itemType;

            // Add keybind indicator
            const keybind = document.createElement('div');
            keybind.className = 'keybind';
            keybind.textContent = metadata.keybind;
            slot.appendChild(keybind);

            // Add item icon
            const icon = document.createElement('div');
            icon.className = 'item-icon';
            icon.textContent = metadata.icon;
            slot.appendChild(icon);

            // Add item name
            const name = document.createElement('div');
            name.className = 'item-name';
            name.textContent = metadata.name;
            slot.appendChild(name);

            // Add item count
            const count = document.createElement('div');
            count.className = 'item-count';
            count.textContent = `${itemStatus.remaining}/${itemStatus.limit}`;
            slot.appendChild(count);

            // Apply visual states
            if (itemStatus.remaining === 0) {
                slot.classList.add('depleted');
                count.classList.add('depleted');
            } else if (itemStatus.remaining <= Math.ceil(itemStatus.limit / 3)) {
                count.classList.add('low');
            }

            this.inventorySlotsContainer.appendChild(slot);
        }
    }

    /**
     * Update inventory hotbar counts
     */
    updateInventory = () => {
        if (!this.inventoryManager) return;

        const status = this.inventoryManager.getInventoryStatus();

        // Update each slot
        for (const [itemType, itemStatus] of Object.entries(status)) {
            const slot = this.inventorySlotsContainer.querySelector(`[data-item-type="${itemType}"]`);
            if (!slot) continue;

            const countElement = slot.querySelector('.item-count');
            if (countElement) {
                countElement.textContent = `${itemStatus.remaining}/${itemStatus.limit}`;

                // Update visual states
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

        // Update inventory hotbar
        this.updateInventory();
    }
}
