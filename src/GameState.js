/**
 * Game State Manager
 * Manages game phases, scoring, and win/lose conditions
 */

export class GameState {
    constructor() {
        // Game phases
        this.phase = 'PREPARATION'; // PREPARATION, SIMULATION, EVALUATION
        
        // Scoring
        this.score = 100;
        this.startingScore = 100;
        
        // Timer
        this.maxTime = 20.0;
        this.timeRemaining = this.maxTime;
        this.timeElapsed = 0;
        
        // Fish tracking
        this.fishTotal = 100;
        this.fishAlive = 100;
        this.fishSaved = 0;
        
        // Level configuration
        this.requiredSurvivalPercentage = 0.6; // 60%
    }
    
    startSimulation = () => {
        if (this.phase !== 'PREPARATION') return;
        
        this.phase = 'SIMULATION';
        this.timeRemaining = this.maxTime;
        this.timeElapsed = 0;
        
        console.log('Simulation started!');
    }
    
    restartLevel = () => {
        this.phase = 'PREPARATION';
        this.score = this.startingScore;
        this.timeRemaining = this.maxTime;
        this.timeElapsed = 0;
        this.fishAlive = this.fishTotal;
        this.fishSaved = 0;
        
        console.log('Level restarted');
    }
    
    onFishDeath = () => {
        this.fishAlive = Math.max(0, this.fishAlive - 1);
        this.score -= 10;
        this.score = Math.max(0, this.score);
    }
    
    onFishReachedGoal = () => {
        this.fishSaved++;
    }
    
    update = (deltaTime) => {
        if (this.phase !== 'SIMULATION') return;
        
        // Update timer
        this.timeElapsed += deltaTime;
        this.timeRemaining = Math.max(0, this.maxTime - this.timeElapsed);
        
        // Time penalty
        this.score -= 0.5 * deltaTime;
        this.score = Math.max(0, this.score);
        
        // Check win/lose conditions
        if (this.timeRemaining <= 0) {
            this.evaluateLevel();
        }
    }
    
    evaluateLevel = () => {
        this.phase = 'EVALUATION';
        
        const survivalRate = this.fishSaved / this.fishTotal;
        
        if (survivalRate >= this.requiredSurvivalPercentage) {
            // Win
            this.score += 50; // Completion bonus
            console.log('LEVEL COMPLETE!');
            console.log(`Survival Rate: ${(survivalRate * 100).toFixed(1)}%`);
            console.log(`Final Score: ${Math.floor(this.score)}`);
        } else {
            // Lose
            console.log('LEVEL FAILED');
            console.log(`Survival Rate: ${(survivalRate * 100).toFixed(1)}% (Required: ${(this.requiredSurvivalPercentage * 100)}%)`);
            console.log(`Final Score: ${Math.floor(this.score)}`);
        }
    }
}
