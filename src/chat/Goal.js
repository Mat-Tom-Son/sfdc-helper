'use strict';

/**
 * Goal Management System
 * 
 * Enables the chat agent to set, track, and complete multi-step goals
 * across conversation turns, making interactions feel more helpful and natural.
 */

class Goal {
  constructor(type, userId, context = {}, customSteps = null) {
    this.id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this.type = type;
    this.userId = userId;
    this.status = 'active'; // active, completed, paused, failed
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.currentStep = 0;
    this.context = context; // Goal-specific data and findings
    this.progress = [];
    this.customSteps = customSteps;
    
    // Load template for this goal type
    this.template = GoalTemplates.getTemplate(type);
    if (!this.template && !customSteps) {
      throw new Error(`Unknown goal type: ${type}`);
    }
  }

  getSteps() {
    return this.customSteps || this.template.steps;
  }

  getCurrentStep() {
    const steps = this.getSteps();
    return steps[this.currentStep] || null;
  }

  getNextStep() {
    const steps = this.getSteps();
    return steps[this.currentStep + 1] || null;
  }

  advanceStep(stepResult, insights = null) {
    const currentStep = this.getCurrentStep();
    if (!currentStep) return false;

    this.progress.push({
      step: currentStep,
      stepIndex: this.currentStep,
      completedAt: new Date(),
      result: stepResult,
      insights: insights
    });

    this.currentStep++;
    this.updatedAt = new Date();

    // Update context with step results
    if (stepResult && typeof stepResult === 'object') {
      this.context = { ...this.context, ...stepResult };
    }

    return true;
  }

  isComplete() {
    const steps = this.getSteps();
    return this.currentStep >= steps.length;
  }

  getProgressSummary() {
    const steps = this.getSteps();
    const completed = this.progress.length;
    const total = steps.length;
    const current = this.getCurrentStep();
    
    return {
      goalName: this.template?.name || `Custom Goal (${this.type})`,
      completed,
      total,
      current,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  getDetailedProgress() {
    const summary = this.getProgressSummary();
    const steps = this.getSteps();
    
    return {
      ...summary,
      steps: steps.map((step, index) => ({
        name: step,
        status: index < this.currentStep ? 'completed' : 
                index === this.currentStep ? 'current' : 'pending',
        completedAt: this.progress.find(p => p.stepIndex === index)?.completedAt,
        result: this.progress.find(p => p.stepIndex === index)?.result
      }))
    };
  }

  complete(finalResult = null) {
    this.status = 'completed';
    this.updatedAt = new Date();
    if (finalResult) {
      this.context.finalResult = finalResult;
    }
  }

  pause(reason = null) {
    this.status = 'paused';
    this.updatedAt = new Date();
    if (reason) {
      this.context.pauseReason = reason;
    }
  }

  resume() {
    if (this.status === 'paused') {
      this.status = 'active';
      this.updatedAt = new Date();
      delete this.context.pauseReason;
    }
  }

  fail(reason = null) {
    this.status = 'failed';
    this.updatedAt = new Date();
    if (reason) {
      this.context.failureReason = reason;
    }
  }

  // Get contextual data for a specific aspect
  getContextData(key) {
    return this.context[key];
  }

  // Update contextual data
  updateContext(key, value) {
    this.context[key] = value;
    this.updatedAt = new Date();
  }

  // Serialize for storage
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      userId: this.userId,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      currentStep: this.currentStep,
      context: this.context,
      progress: this.progress,
      customSteps: this.customSteps
    };
  }

  // Deserialize from storage
  static fromJSON(data) {
    const goal = new Goal(data.type, data.userId, data.context, data.customSteps);
    goal.id = data.id;
    goal.status = data.status;
    goal.createdAt = new Date(data.createdAt);
    goal.updatedAt = new Date(data.updatedAt);
    goal.currentStep = data.currentStep;
    goal.progress = data.progress.map(p => ({
      ...p,
      completedAt: new Date(p.completedAt)
    }));
    return goal;
  }
}

/**
 * Goal Templates - Predefined goal types with steps and success criteria
 */
class GoalTemplates {
  static templates = {
    'pipeline_health': {
      name: 'Pipeline Health Assessment',
      description: 'Analyze pipeline performance and identify improvement opportunities',
      steps: [
        'analyze_current_pipeline',
        'identify_bottlenecks', 
        'assess_deal_velocity',
        'suggest_actions'
      ],
      successCriteria: 'User has clear understanding of pipeline health with actionable next steps',
      estimatedTurns: 4
    },

    'deal_rescue': {
      name: 'Rescue Stalled Deals',
      description: 'Identify and create action plans for deals that need attention',
      steps: [
        'find_stalled_deals',
        'analyze_stall_patterns',
        'prioritize_by_value_probability',
        'create_action_plans'
      ],
      successCriteria: 'User has prioritized list of deals with specific rescue actions',
      estimatedTurns: 4
    },

    'forecast_accuracy': {
      name: 'Improve Forecast Accuracy',
      description: 'Review and refine sales forecasting based on data patterns',
      steps: [
        'review_current_forecast',
        'analyze_historical_accuracy',
        'identify_risk_factors',
        'refine_predictions'
      ],
      successCriteria: 'User has confidence in forecast numbers with risk mitigation',
      estimatedTurns: 5
    },

    'territory_analysis': {
      name: 'Territory Performance Analysis',
      description: 'Analyze territory or rep performance and identify optimization opportunities',
      steps: [
        'gather_territory_data',
        'compare_performance_metrics',
        'identify_top_performers',
        'suggest_optimizations'
      ],
      successCriteria: 'User understands territory performance with optimization plan',
      estimatedTurns: 4
    },

    'customer_health': {
      name: 'Customer Health Check',
      description: 'Assess customer relationship health and identify at-risk accounts',
      steps: [
        'analyze_customer_engagement',
        'identify_health_indicators',
        'flag_at_risk_accounts',
        'create_retention_plan'
      ],
      successCriteria: 'User has customer health insights with retention strategies',
      estimatedTurns: 4
    },

    'sales_process_optimization': {
      name: 'Sales Process Optimization',
      description: 'Analyze and improve sales process efficiency',
      steps: [
        'map_current_process',
        'identify_process_gaps',
        'benchmark_best_practices',
        'recommend_improvements'
      ],
      successCriteria: 'User has process improvement roadmap with specific recommendations',
      estimatedTurns: 5
    }
  };

  static getTemplate(type) {
    return this.templates[type] || null;
  }

  static getAllTemplates() {
    return { ...this.templates };
  }

  static getTemplateNames() {
    return Object.keys(this.templates);
  }

  static addCustomTemplate(type, template) {
    this.templates[type] = template;
  }
}

module.exports = { Goal, GoalTemplates };
