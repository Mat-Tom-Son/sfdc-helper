'use strict';

/**
 * Tests for Goal class and GoalTemplates
 */

const { Goal, GoalTemplates } = require('../Goal');

// Simple test runner
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('🧪 Running Goal Tests\n');
    
    for (const { name, fn } of this.tests) {
      try {
        await fn();
        console.log(`✅ ${name}`);
        this.passed++;
      } catch (error) {
        console.log(`❌ ${name}: ${error.message}`);
        this.failed++;
      }
    }

    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed`);
    return this.failed === 0;
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  }
}

const runner = new TestRunner();

// Goal Creation Tests
runner.test('Goal can be created with valid type', () => {
  const goal = new Goal('pipeline_health', 'user123');
  
  runner.assert(goal.id.startsWith('pipeline_health_'), 'Goal ID should start with type');
  runner.assertEqual(goal.type, 'pipeline_health', 'Goal type should match');
  runner.assertEqual(goal.userId, 'user123', 'User ID should match');
  runner.assertEqual(goal.status, 'active', 'Goal should start as active');
  runner.assert(goal.template, 'Goal should have template');
});

runner.test('Goal throws error for invalid type', () => {
  try {
    new Goal('invalid_type', 'user123');
    throw new Error('Should have thrown error for invalid type');
  } catch (error) {
    runner.assert(error.message.includes('Unknown goal type'), 'Should throw unknown type error');
  }
});

runner.test('Goal can be created with custom steps', () => {
  const customSteps = ['step1', 'step2', 'step3'];
  const goal = new Goal('custom', 'user123', {}, customSteps);
  
  runner.assertEqual(goal.getSteps().length, 3, 'Should have 3 custom steps');
  runner.assertEqual(goal.getCurrentStep(), 'step1', 'Should start at first step');
});

// Goal Progress Tests
runner.test('Goal can advance through steps', () => {
  const goal = new Goal('pipeline_health', 'user123');
  const initialStep = goal.getCurrentStep();
  
  const advanced = goal.advanceStep({ data: 'test result' }, 'Test insight');
  
  runner.assert(advanced, 'Should successfully advance step');
  runner.assert(goal.getCurrentStep() !== initialStep, 'Should move to next step');
  runner.assertEqual(goal.progress.length, 1, 'Should have one completed step');
  runner.assertEqual(goal.progress[0].result.data, 'test result', 'Should store step result');
});

runner.test('Goal completion works correctly', () => {
  const goal = new Goal('pipeline_health', 'user123');
  
  // Complete all steps
  const steps = goal.getSteps();
  for (let i = 0; i < steps.length; i++) {
    goal.advanceStep({ step: i }, `Completed step ${i}`);
  }
  
  runner.assert(goal.isComplete(), 'Goal should be complete');
  
  goal.complete({ finalResult: 'success' });
  runner.assertEqual(goal.status, 'completed', 'Goal status should be completed');
  runner.assertEqual(goal.context.finalResult.finalResult, 'success', 'Should store final result');
});

runner.test('Goal progress summary is accurate', () => {
  const goal = new Goal('pipeline_health', 'user123');
  
  // Complete 2 out of 4 steps
  goal.advanceStep({ data: 'step1' });
  goal.advanceStep({ data: 'step2' });
  
  const summary = goal.getProgressSummary();
  
  runner.assertEqual(summary.completed, 2, 'Should show 2 completed steps');
  runner.assertEqual(summary.total, 4, 'Should show 4 total steps');
  runner.assertEqual(summary.percentage, 50, 'Should show 50% progress');
  runner.assert(summary.goalName.includes('Pipeline Health'), 'Should include goal name');
});

runner.test('Goal can be paused and resumed', () => {
  const goal = new Goal('pipeline_health', 'user123');
  
  goal.pause('Testing pause functionality');
  runner.assertEqual(goal.status, 'paused', 'Goal should be paused');
  runner.assertEqual(goal.context.pauseReason, 'Testing pause functionality', 'Should store pause reason');
  
  goal.resume();
  runner.assertEqual(goal.status, 'active', 'Goal should be active again');
  runner.assert(!goal.context.pauseReason, 'Should remove pause reason');
});

// Goal Serialization Tests
runner.test('Goal can be serialized and deserialized', () => {
  const original = new Goal('deal_rescue', 'user456', { initialData: 'test' });
  original.advanceStep({ completed: 'first step' });
  
  const json = original.toJSON();
  const restored = Goal.fromJSON(json);
  
  runner.assertEqual(restored.id, original.id, 'ID should match');
  runner.assertEqual(restored.type, original.type, 'Type should match');
  runner.assertEqual(restored.userId, original.userId, 'User ID should match');
  runner.assertEqual(restored.currentStep, original.currentStep, 'Current step should match');
  runner.assertEqual(restored.progress.length, original.progress.length, 'Progress should match');
  runner.assertEqual(restored.context.initialData, 'test', 'Context should be preserved');
});

// GoalTemplates Tests
runner.test('GoalTemplates provides valid templates', () => {
  const templates = GoalTemplates.getAllTemplates();
  
  runner.assert(Object.keys(templates).length > 0, 'Should have templates');
  runner.assert(templates.pipeline_health, 'Should have pipeline_health template');
  runner.assert(templates.deal_rescue, 'Should have deal_rescue template');
  
  const template = templates.pipeline_health;
  runner.assert(template.name, 'Template should have name');
  runner.assert(template.steps && template.steps.length > 0, 'Template should have steps');
  runner.assert(template.successCriteria, 'Template should have success criteria');
});

runner.test('GoalTemplates can get specific template', () => {
  const template = GoalTemplates.getTemplate('pipeline_health');
  
  runner.assert(template, 'Should return template');
  runner.assertEqual(template.name, 'Pipeline Health Assessment', 'Should have correct name');
  runner.assert(Array.isArray(template.steps), 'Should have steps array');
});

runner.test('GoalTemplates returns null for invalid type', () => {
  const template = GoalTemplates.getTemplate('invalid_type');
  runner.assertEqual(template, null, 'Should return null for invalid type');
});

runner.test('GoalTemplates can add custom template', () => {
  const customTemplate = {
    name: 'Test Template',
    steps: ['test1', 'test2'],
    successCriteria: 'Test completed'
  };
  
  GoalTemplates.addCustomTemplate('test_template', customTemplate);
  
  const retrieved = GoalTemplates.getTemplate('test_template');
  runner.assert(retrieved, 'Should retrieve custom template');
  runner.assertEqual(retrieved.name, 'Test Template', 'Should have correct name');
});

// Context and Data Management Tests
runner.test('Goal context can be updated', () => {
  const goal = new Goal('pipeline_health', 'user123');
  
  goal.updateContext('analysisData', { records: 50, issues: 3 });
  
  const data = goal.getContextData('analysisData');
  runner.assertEqual(data.records, 50, 'Should store context data');
  runner.assertEqual(data.issues, 3, 'Should store nested context data');
});

runner.test('Goal detailed progress includes step status', () => {
  const goal = new Goal('pipeline_health', 'user123');
  
  goal.advanceStep({ data: 'first' });
  goal.advanceStep({ data: 'second' });
  
  const detailed = goal.getDetailedProgress();
  
  runner.assert(detailed.steps, 'Should have steps array');
  runner.assertEqual(detailed.steps[0].status, 'completed', 'First step should be completed');
  runner.assertEqual(detailed.steps[1].status, 'completed', 'Second step should be completed');
  runner.assertEqual(detailed.steps[2].status, 'current', 'Third step should be current');
  runner.assertEqual(detailed.steps[3].status, 'pending', 'Fourth step should be pending');
});

// Export for use in other test files
if (require.main === module) {
  runner.run().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { TestRunner, runner };
