'use strict';

const fs = require('fs').promises;
const path = require('path');
const { Goal, GoalTemplates } = require('./Goal');

/**
 * GoalManager - Manages goal lifecycle and persistence
 * 
 * Handles creating, tracking, updating, and persisting goals across
 * conversation sessions. Provides lightweight storage and retrieval.
 */
class GoalManager {
  constructor(options = {}) {
    this.goals = new Map(); // goalId -> Goal
    this.userGoals = new Map(); // userId -> Set of goalIds
    this.persistPath = options.persistPath || path.join(process.cwd(), 'data', 'goals.json');
    this.autoPersist = options.autoPersist !== false; // Default to true
    this.maxGoalsPerUser = options.maxGoalsPerUser || 10;
    
    // Initialize storage
    this.ensureDataDirectory();
    this.loadGoals();
  }

  async ensureDataDirectory() {
    try {
      const dir = path.dirname(this.persistPath);
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      console.warn('[GoalManager] Could not create data directory:', error.message);
    }
  }

  /**
   * Create a new goal for a user
   */
  createGoal(type, userId, context = {}, customSteps = null) {
    // Check if user has too many active goals
    const userActiveGoals = this.getActiveGoals(userId);
    if (userActiveGoals.length >= this.maxGoalsPerUser) {
      throw new Error(`User has too many active goals (max: ${this.maxGoalsPerUser})`);
    }

    const goal = new Goal(type, userId, context, customSteps);
    
    // Store the goal
    this.goals.set(goal.id, goal);
    
    // Update user goal tracking
    if (!this.userGoals.has(userId)) {
      this.userGoals.set(userId, new Set());
    }
    this.userGoals.get(userId).add(goal.id);

    // Auto-persist if enabled
    if (this.autoPersist) {
      this.persistGoals().catch(err => 
        console.warn('[GoalManager] Auto-persist failed:', err.message)
      );
    }

    return goal;
  }

  /**
   * Get a goal by ID
   */
  getGoal(goalId) {
    return this.goals.get(goalId);
  }

  /**
   * Get all goals for a user
   */
  getUserGoals(userId) {
    const goalIds = this.userGoals.get(userId) || new Set();
    return Array.from(goalIds)
      .map(id => this.goals.get(id))
      .filter(goal => goal) // Filter out any missing goals
      .sort((a, b) => b.updatedAt - a.updatedAt); // Most recently updated first
  }

  /**
   * Get active goals for a user
   */
  getActiveGoals(userId) {
    return this.getUserGoals(userId)
      .filter(goal => goal.status === 'active');
  }

  /**
   * Get completed goals for a user
   */
  getCompletedGoals(userId, limit = 10) {
    return this.getUserGoals(userId)
      .filter(goal => goal.status === 'completed')
      .slice(0, limit);
  }

  /**
   * Update goal progress
   */
  updateGoalProgress(goalId, stepResult, insights = null) {
    const goal = this.goals.get(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    const advanced = goal.advanceStep(stepResult, insights);
    
    if (advanced && goal.isComplete()) {
      goal.complete();
    }

    // Auto-persist if enabled
    if (this.autoPersist) {
      this.persistGoals().catch(err => 
        console.warn('[GoalManager] Auto-persist failed:', err.message)
      );
    }

    return { goal, advanced, completed: goal.isComplete() };
  }

  /**
   * Complete a goal
   */
  completeGoal(goalId, finalResult = null) {
    const goal = this.goals.get(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    goal.complete(finalResult);

    // Auto-persist if enabled
    if (this.autoPersist) {
      this.persistGoals().catch(err => 
        console.warn('[GoalManager] Auto-persist failed:', err.message)
      );
    }

    return goal;
  }

  /**
   * Pause a goal
   */
  pauseGoal(goalId, reason = null) {
    const goal = this.goals.get(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    goal.pause(reason);

    // Auto-persist if enabled
    if (this.autoPersist) {
      this.persistGoals().catch(err => 
        console.warn('[GoalManager] Auto-persist failed:', err.message)
      );
    }

    return goal;
  }

  /**
   * Resume a paused goal
   */
  resumeGoal(goalId) {
    const goal = this.goals.get(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    goal.resume();

    // Auto-persist if enabled
    if (this.autoPersist) {
      this.persistGoals().catch(err => 
        console.warn('[GoalManager] Auto-persist failed:', err.message)
      );
    }

    return goal;
  }

  /**
   * Delete a goal
   */
  deleteGoal(goalId) {
    const goal = this.goals.get(goalId);
    if (!goal) {
      return false;
    }

    // Remove from main storage
    this.goals.delete(goalId);

    // Remove from user tracking
    const userGoalSet = this.userGoals.get(goal.userId);
    if (userGoalSet) {
      userGoalSet.delete(goalId);
      if (userGoalSet.size === 0) {
        this.userGoals.delete(goal.userId);
      }
    }

    // Auto-persist if enabled
    if (this.autoPersist) {
      this.persistGoals().catch(err => 
        console.warn('[GoalManager] Auto-persist failed:', err.message)
      );
    }

    return true;
  }

  /**
   * Find goals that might be related to a query or context
   */
  findRelatedGoals(userId, query, objectName = null) {
    const activeGoals = this.getActiveGoals(userId);
    const related = [];

    for (const goal of activeGoals) {
      // Check if goal context mentions the object
      if (objectName && goal.context && 
          JSON.stringify(goal.context).toLowerCase().includes(objectName.toLowerCase())) {
        related.push({ goal, relevance: 'object_match' });
      }

      // Check if query relates to goal type or current step
      const queryLower = query.toLowerCase();
      const goalType = goal.type.toLowerCase();
      const currentStep = goal.getCurrentStep()?.toLowerCase() || '';

      if (queryLower.includes(goalType.replace('_', ' ')) || 
          queryLower.includes(currentStep.replace('_', ' '))) {
        related.push({ goal, relevance: 'query_match' });
      }

      // Check template keywords
      const template = goal.template;
      if (template && template.description) {
        const keywords = template.description.toLowerCase().split(/\s+/);
        const hasKeyword = keywords.some(keyword => queryLower.includes(keyword));
        if (hasKeyword) {
          related.push({ goal, relevance: 'keyword_match' });
        }
      }
    }

    // Remove duplicates and sort by relevance
    const uniqueGoals = new Map();
    related.forEach(({ goal, relevance }) => {
      if (!uniqueGoals.has(goal.id)) {
        uniqueGoals.set(goal.id, { goal, relevance });
      }
    });

    return Array.from(uniqueGoals.values());
  }

  /**
   * Get goal statistics for a user
   */
  getUserStats(userId) {
    const goals = this.getUserGoals(userId);
    const active = goals.filter(g => g.status === 'active').length;
    const completed = goals.filter(g => g.status === 'completed').length;
    const paused = goals.filter(g => g.status === 'paused').length;
    
    return {
      total: goals.length,
      active,
      completed,
      paused,
      completionRate: goals.length > 0 ? Math.round((completed / goals.length) * 100) : 0
    };
  }

  /**
   * Clean up old completed goals
   */
  cleanupOldGoals(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30 days default
    const cutoff = new Date(Date.now() - maxAge);
    let cleaned = 0;

    for (const [goalId, goal] of this.goals.entries()) {
      if (goal.status === 'completed' && goal.updatedAt < cutoff) {
        this.deleteGoal(goalId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Persist goals to storage
   */
  async persistGoals() {
    try {
      const data = {
        goals: {},
        userGoals: {},
        metadata: {
          version: '1.0',
          savedAt: new Date().toISOString(),
          totalGoals: this.goals.size
        }
      };

      // Serialize goals
      for (const [id, goal] of this.goals.entries()) {
        data.goals[id] = goal.toJSON();
      }

      // Serialize user goal mappings
      for (const [userId, goalIds] of this.userGoals.entries()) {
        data.userGoals[userId] = Array.from(goalIds);
      }

      await fs.writeFile(this.persistPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      console.error('[GoalManager] Failed to persist goals:', error.message);
      throw error;
    }
  }

  /**
   * Load goals from storage
   */
  async loadGoals() {
    try {
      const data = await fs.readFile(this.persistPath, 'utf8');
      if (!data.trim()) {
        console.log('[GoalManager] Empty goals file found, starting fresh');
        return;
      }
      const parsed = JSON.parse(data);

      // Clear existing data
      this.goals.clear();
      this.userGoals.clear();

      // Load goals
      if (parsed.goals) {
        for (const [id, goalData] of Object.entries(parsed.goals)) {
          try {
            const goal = Goal.fromJSON(goalData);
            this.goals.set(id, goal);
          } catch (error) {
            console.warn(`[GoalManager] Failed to load goal ${id}:`, error.message);
          }
        }
      }

      // Load user goal mappings
      if (parsed.userGoals) {
        for (const [userId, goalIds] of Object.entries(parsed.userGoals)) {
          this.userGoals.set(userId, new Set(goalIds));
        }
      }

      console.log(`[GoalManager] Loaded ${this.goals.size} goals from storage`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, that's fine
        console.log('[GoalManager] No existing goals file found, starting fresh');
      } else {
        console.warn('[GoalManager] Failed to load goals:', error.message);
      }
    }
  }

  /**
   * Get available goal templates
   */
  getAvailableTemplates() {
    return GoalTemplates.getAllTemplates();
  }

  /**
   * Suggest goal templates based on query
   */
  suggestGoalTemplates(query, limit = 3) {
    const templates = GoalTemplates.getAllTemplates();
    const queryLower = query ? query.toLowerCase() : '';
    const suggestions = [];

    for (const [type, template] of Object.entries(templates)) {
      let score = 0;
      
      if (!queryLower) {
        // If no query, return all templates with base score
        score = 1;
      } else {
        // Check name match
        if (template.name && queryLower.includes(template.name.toLowerCase())) {
          score += 10;
        }

        // Check description match
        if (template.description) {
          const descWords = template.description.toLowerCase().split(/\s+/);
          const queryWords = queryLower.split(/\s+/);
          
          for (const word of queryWords) {
            if (descWords.includes(word)) {
              score += 1;
            }
          }
        }

        // Check step keywords
        if (template.steps) {
          for (const step of template.steps) {
            const stepWords = step.toLowerCase().replace(/_/g, ' ').split(/\s+/);
            const queryWords = queryLower.split(/\s+/);
            for (const word of queryWords) {
              if (stepWords.includes(word)) {
                score += 0.5;
              }
            }
          }
        }
      }

      if (score > 0) {
        suggestions.push({ type, template, score });
      }
    }

    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ type, template }) => ({ type, template }));
  }
}

module.exports = GoalManager;
