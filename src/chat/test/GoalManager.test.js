'use strict';

/**
 * Tests for GoalManager class
 */

const fs = require('fs').promises;
const path = require('path');
const GoalManager = require('../GoalManager');
const { TestRunner } = require('./Goal.test');

const runner = new TestRunner();

// Test data directory
const testDataDir = path.join(__dirname, 'test-data');
const testGoalsFile = path.join(testDataDir, 'test-goals.json');

// Setup and cleanup helpers
async function setupTestData() {
  try {
    await fs.mkdir(testDataDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
}

async function cleanupTestData() {
  try {
    await fs.rm(testDataDir, { recursive: true, force: true });
  } catch (error) {
    // Directory might not exist
  }
}

// GoalManager Creation Tests
runner.test('GoalManager can be created with default options', () => {
  const manager = new GoalManager();
  
  runner.assert(manager.goals instanceof Map, 'Should have goals Map');
  runner.assert(manager.userGoals instanceof Map, 'Should have userGoals Map');
  runner.assertEqual(manager.maxGoalsPerUser, 10, 'Should have default max goals');
  runner.assertEqual(manager.autoPersist, true, 'Should have autoPersist enabled by default');
});

runner.test('GoalManager can be created with custom options', () => {
  const options = {
    persistPath: testGoalsFile,
    autoPersist: false,
    maxGoalsPerUser: 3
  };
  
  const manager = new GoalManager(options);
  
  runner.assertEqual(manager.persistPath, testGoalsFile, 'Should use custom persist path');
  runner.assertEqual(manager.autoPersist, false, 'Should respect autoPersist setting');
  runner.assertEqual(manager.maxGoalsPerUser, 3, 'Should use custom max goals');
});

// Goal Creation and Management Tests
runner.test('GoalManager can create goals', async () => {
  await setupTestData();
  
  const manager = new GoalManager({
    persistPath: testGoalsFile,
    autoPersist: false
  });
  
  const goal = manager.createGoal('pipeline_health', 'user123', { test: 'data' });
  
  runner.assert(goal.id, 'Goal should have ID');
  runner.assertEqual(goal.type, 'pipeline_health', 'Goal should have correct type');
  runner.assertEqual(goal.userId, 'user123', 'Goal should have correct user ID');
  runner.assertEqual(goal.context.test, 'data', 'Goal should have context data');
  
  // Check manager state
  runner.assert(manager.goals.has(goal.id), 'Manager should store goal');
  runner.assert(manager.userGoals.get('user123').has(goal.id), 'Manager should track user goals');
  
  await cleanupTestData();
});

runner.test('GoalManager enforces max goals per user', async () => {
  await setupTestData();
  
  const manager = new GoalManager({
    persistPath: testGoalsFile,
    autoPersist: false,
    maxGoalsPerUser: 2
  });
  
  // Create max allowed goals
  manager.createGoal('pipeline_health', 'user123');
  manager.createGoal('deal_rescue', 'user123');
  
  // Try to create one more
  try {
    manager.createGoal('forecast_accuracy', 'user123');
    throw new Error('Should have thrown max goals error');
  } catch (error) {
    runner.assert(error.message.includes('too many active goals'), 'Should enforce max goals limit');
  }
  
  await cleanupTestData();
});

runner.test('GoalManager can retrieve goals by user', async () => {
  await setupTestData();
  
  const manager = new GoalManager({
    persistPath: testGoalsFile,
    autoPersist: false
  });
  
  // Create goals for different users
  const goal1 = manager.createGoal('pipeline_health', 'user123');
  const goal2 = manager.createGoal('deal_rescue', 'user123');
  const goal3 = manager.createGoal('pipeline_health', 'user456');
  
  const user123Goals = manager.getUserGoals('user123');
  const user456Goals = manager.getUserGoals('user456');
  
  runner.assertEqual(user123Goals.length, 2, 'User123 should have 2 goals');
  runner.assertEqual(user456Goals.length, 1, 'User456 should have 1 goal');
  
  const activeGoals = manager.getActiveGoals('user123');
  runner.assertEqual(activeGoals.length, 2, 'User123 should have 2 active goals');
  
  await cleanupTestData();
});

runner.test('GoalManager can update goal progress', async () => {
  await setupTestData();
  
  const manager = new GoalManager({
    persistPath: testGoalsFile,
    autoPersist: false
  });
  
  const goal = manager.createGoal('pipeline_health', 'user123');
  const initialStep = goal.getCurrentStep();
  
  const result = manager.updateGoalProgress(goal.id, { data: 'test' }, 'Progress made');
  
  runner.assert(result.advanced, 'Should advance goal step');
  runner.assert(result.goal.getCurrentStep() !== initialStep, 'Goal should be on next step');
  runner.assertEqual(result.goal.progress.length, 1, 'Goal should have progress recorded');
  
  await cleanupTestData();
});

runner.test('GoalManager can complete goals', async () => {
  await setupTestData();
  
  const manager = new GoalManager({
    persistPath: testGoalsFile,
    autoPersist: false
  });
  
  const goal = manager.createGoal('pipeline_health', 'user123');
  
  const completedGoal = manager.completeGoal(goal.id, { result: 'success' });
  
  runner.assertEqual(completedGoal.status, 'completed', 'Goal should be completed');
  runner.assertEqual(completedGoal.context.finalResult.result, 'success', 'Should store final result');
  
  const activeGoals = manager.getActiveGoals('user123');
  const completedGoals = manager.getCompletedGoals('user123');
  
  runner.assertEqual(activeGoals.length, 0, 'Should have no active goals');
  runner.assertEqual(completedGoals.length, 1, 'Should have 1 completed goal');
  
  await cleanupTestData();
});

runner.test('GoalManager can pause and resume goals', async () => {
  await setupTestData();
  
  const manager = new GoalManager({
    persistPath: testGoalsFile,
    autoPersist: false
  });
  
  const goal = manager.createGoal('pipeline_health', 'user123');
  
  // Pause goal
  const pausedGoal = manager.pauseGoal(goal.id, 'Testing pause');
  runner.assertEqual(pausedGoal.status, 'paused', 'Goal should be paused');
  
  // Check active goals
  const activeGoals = manager.getActiveGoals('user123');
  runner.assertEqual(activeGoals.length, 0, 'Should have no active goals when paused');
  
  // Resume goal
  const resumedGoal = manager.resumeGoal(goal.id);
  runner.assertEqual(resumedGoal.status, 'active', 'Goal should be active again');
  
  const activeGoalsAfter = manager.getActiveGoals('user123');
  runner.assertEqual(activeGoalsAfter.length, 1, 'Should have 1 active goal after resume');
  
  await cleanupTestData();
});

// Goal Finding and Suggestions Tests
runner.test('GoalManager can find related goals', async () => {
  await setupTestData();
  
  const manager = new GoalManager({
    persistPath: testGoalsFile,
    autoPersist: false
  });
  
  // Create goal with context
  const goal = manager.createGoal('pipeline_health', 'user123', { 
    objectName: 'Opportunity',
    analysis: 'pipeline data'
  });
  
  // Find related goals
  const related = manager.findRelatedGoals('user123', 'show me opportunities', 'Opportunity');
  
  runner.assertEqual(related.length, 1, 'Should find 1 related goal');
  runner.assertEqual(related[0].goal.id, goal.id, 'Should find the correct goal');
  runner.assertEqual(related[0].relevance, 'object_match', 'Should identify object relevance');
  
  await cleanupTestData();
});

runner.test('GoalManager can suggest goal templates', () => {
  const manager = new GoalManager();
  
  const suggestions = manager.suggestGoalTemplates('pipeline analysis performance');
  
  runner.assert(suggestions.length > 0, 'Should return suggestions');
  
  // Should prioritize pipeline-related templates
  const pipelineSuggestion = suggestions.find(s => s.type === 'pipeline_health');
  runner.assert(pipelineSuggestion, 'Should suggest pipeline_health template');
});

runner.test('GoalManager provides user statistics', async () => {
  await setupTestData();
  
  const manager = new GoalManager({
    persistPath: testGoalsFile,
    autoPersist: false
  });
  
  // Create mix of goals
  const goal1 = manager.createGoal('pipeline_health', 'user123');
  const goal2 = manager.createGoal('deal_rescue', 'user123');
  
  // Complete one goal
  manager.completeGoal(goal1.id);
  
  const stats = manager.getUserStats('user123');
  
  runner.assertEqual(stats.total, 2, 'Should show 2 total goals');
  runner.assertEqual(stats.active, 1, 'Should show 1 active goal');
  runner.assertEqual(stats.completed, 1, 'Should show 1 completed goal');
  runner.assertEqual(stats.completionRate, 50, 'Should show 50% completion rate');
  
  await cleanupTestData();
});

// Persistence Tests
runner.test('GoalManager can persist and load goals', async () => {
  await setupTestData();
  
  // Create manager and goals
  const manager1 = new GoalManager({
    persistPath: testGoalsFile,
    autoPersist: false
  });
  
  const goal1 = manager1.createGoal('pipeline_health', 'user123', { test: 'data' });
  const goal2 = manager1.createGoal('deal_rescue', 'user456');
  
  // Advance goal progress
  manager1.updateGoalProgress(goal1.id, { step1: 'completed' });
  
  // Persist goals
  await manager1.persistGoals();
  
  // Create new manager and load goals
  const manager2 = new GoalManager({
    persistPath: testGoalsFile,
    autoPersist: false
  });
  
  await manager2.loadGoals();
  
  // Verify goals were loaded
  runner.assertEqual(manager2.goals.size, 2, 'Should load 2 goals');
  
  const loadedGoal1 = manager2.getGoal(goal1.id);
  runner.assert(loadedGoal1, 'Should load goal1');
  runner.assertEqual(loadedGoal1.userId, 'user123', 'Should preserve user ID');
  runner.assertEqual(loadedGoal1.context.test, 'data', 'Should preserve context');
  runner.assertEqual(loadedGoal1.progress.length, 1, 'Should preserve progress');
  
  const user123Goals = manager2.getUserGoals('user123');
  runner.assertEqual(user123Goals.length, 1, 'Should maintain user goal mapping');
  
  await cleanupTestData();
});

runner.test('GoalManager handles missing persistence file gracefully', async () => {
  await cleanupTestData(); // Ensure no file exists
  
  const manager = new GoalManager({
    persistPath: testGoalsFile,
    autoPersist: false
  });
  
  // Should not throw error when loading non-existent file
  await manager.loadGoals();
  
  runner.assertEqual(manager.goals.size, 0, 'Should start with empty goals');
});

runner.test('GoalManager can clean up old goals', async () => {
  await setupTestData();
  
  const manager = new GoalManager({
    persistPath: testGoalsFile,
    autoPersist: false
  });
  
  // Create and complete goals
  const goal1 = manager.createGoal('pipeline_health', 'user123');
  const goal2 = manager.createGoal('deal_rescue', 'user123');
  
  manager.completeGoal(goal1.id);
  manager.completeGoal(goal2.id);
  
  // Manually set old update time
  const oldGoal = manager.getGoal(goal1.id);
  oldGoal.updatedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000); // 31 days ago
  
  // Clean up goals older than 30 days
  const cleaned = manager.cleanupOldGoals(30 * 24 * 60 * 60 * 1000);
  
  runner.assertEqual(cleaned, 1, 'Should clean up 1 old goal');
  runner.assertEqual(manager.goals.size, 1, 'Should have 1 goal remaining');
  runner.assert(!manager.goals.has(goal1.id), 'Old goal should be removed');
  runner.assert(manager.goals.has(goal2.id), 'Recent goal should remain');
  
  await cleanupTestData();
});

// Export for use in other test files
if (require.main === module) {
  runner.run().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = runner;
