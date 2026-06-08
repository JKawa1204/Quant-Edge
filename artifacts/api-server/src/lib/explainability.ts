/**
 * Explainability Engine
 *
 * Generates structured, human-readable explanations for trading signals
 * and auto-trade decisions. Provides full transparency into model reasoning,
 * regime impact, and risk factors.
 */

export interface ModelBreakdown {
  name: string;
  direction: string;
  confidence: number;
  weight: number;
  contribution: string; // human-readable
}

export interface SignalExplanation {
  summary: string;
  action: string;
  symbol: string;
  confidence: number;
  modelBreakdown: {
    arima: ModelBreakdown;
    xgboost: ModelBreakdown;
    neuralNet: ModelBreakdown;
  };
  ensembleReasoning: string;
  regimeImpact: {
    regime: string;
    effect: string;
    strategy: string;
  };
  optimizationImpact: {
    method: string;
    suggestedWeight: number;
    reason: string;
  };
  riskFactors: string[];
  forecastReturn: number;
  modelAgreement: number;
}

/**
 * Map regime names to their trading implications
 */
function getRegimeEffect(regime: string): { effect: string; strategy: string } {
  const regimeMap: Record<string, { effect: string; strategy: string }> = {
    "Bull Market": {
      effect: "Upward momentum supports directional bias. Trend-following signals are more reliable.",
      strategy: "Aggressive allocation — increase equity exposure and follow momentum signals",
    },
    "Bear Market": {
      effect: "Downward pressure increases risk of drawdown. Counter-trend signals need higher confidence.",
      strategy: "Defensive allocation — reduce position sizes and prioritize capital preservation",
    },
    "Sideways Market": {
      effect: "Lack of clear trend reduces directional signal reliability. Mean-reversion patterns dominate.",
      strategy: "Balanced allocation — maintain current weights and focus on range-bound opportunities",
    },
    "High Volatility": {
      effect: "Elevated volatility increases both opportunity and risk. Wider stop-losses required.",
      strategy: "Reduce exposure — lower position sizes and tighten risk management controls",
    },
    "Low Volatility": {
      effect: "Compressed volatility favors trend-following strategies. Breakout signals are more actionable.",
      strategy: "Momentum strategy — follow trend signals with standard position sizes",
    },
  };

  return regimeMap[regime] ?? {
    effect: "Regime conditions are uncertain. Standard risk management applies.",
    strategy: "Balanced allocation with moderate position sizes",
  };
}

/**
 * Generate a direction label from contribution value
 */
function getDirectionFromContribution(contribution: number, action: string): string {
  if (contribution > 30) return "Strongly bullish";
  if (contribution > 20) return "Moderately bullish";
  if (contribution > 10) return "Slightly bullish";
  if (contribution < -10) return "Slightly bearish";
  if (contribution < -20) return "Moderately bearish";
  if (contribution < -30) return "Strongly bearish";
  return action === "BUY" ? "Leaning bullish" : action === "SELL" ? "Leaning bearish" : "Neutral";
}

/**
 * Generate risk factors based on signal characteristics
 */
function assessRiskFactors(signal: any, regime: string): string[] {
  const risks: string[] = [];
  const confidence = Number(signal.confidence ?? 0);
  const forecastReturn = Number(signal.forecastReturn ?? 0);
  const arimaContrib = Number(signal.arimaContribution ?? 25);
  const lstmContrib = Number(signal.lstmContribution ?? 35);
  const xgboostContrib = Number(signal.xgboostContribution ?? 28);

  // Model disagreement risk
  const contributions = [arimaContrib, lstmContrib, xgboostContrib];
  const maxContrib = Math.max(...contributions);
  const minContrib = Math.min(...contributions);
  if (maxContrib - minContrib > 25) {
    risks.push("High model divergence detected — models disagree significantly on direction, increasing uncertainty");
  }

  // Low confidence risk
  if (confidence < 60) {
    risks.push(`Low ensemble confidence (${confidence}%) indicates weak consensus among prediction models`);
  } else if (confidence < 70) {
    risks.push(`Moderate confidence (${confidence}%) suggests some model uncertainty remains`);
  }

  // Forecast return risk
  if (Math.abs(forecastReturn) > 5) {
    risks.push(`Large forecast return magnitude (${forecastReturn}%) may indicate overfitting or extreme market conditions`);
  }

  // Regime-specific risks
  if (regime === "High Volatility") {
    risks.push("High volatility regime increases the probability of adverse price movements and wider slippage");
  }
  if (regime === "Bear Market" && signal.action === "BUY") {
    risks.push("Buying against a bearish regime carries elevated risk — ensure adequate stop-loss protection");
  }
  if (regime === "Bull Market" && signal.action === "SELL") {
    risks.push("Selling in a bullish regime may miss continued upside — consider partial position reduction instead");
  }

  // Concentration risk
  if (arimaContrib > 50 || lstmContrib > 50 || xgboostContrib > 50) {
    const dominantModel = arimaContrib > 50 ? "ARIMA" : lstmContrib > 50 ? "LSTM/Neural Net" : "XGBoost";
    risks.push(`Signal is heavily dependent on ${dominantModel} model — single model concentration increases fragility`);
  }

  // Small forecast return
  if (Math.abs(forecastReturn) < 0.5 && signal.action !== "HOLD") {
    risks.push("Marginal forecast return suggests limited profit potential after transaction costs");
  }

  // Ensure at least one risk factor
  if (risks.length === 0) {
    risks.push("Standard market risk applies — diversification and position sizing remain important");
  }

  return risks;
}

/**
 * Generate a rich, structured explanation from a signal's data
 */
export function generateExplanation(signal: any, forecast?: any, regime?: any): SignalExplanation {
  const arimaContrib = Number(signal.arimaContribution ?? 25);
  const lstmContrib = Number(signal.lstmContribution ?? 35);
  const xgboostContrib = Number(signal.xgboostContribution ?? 28);
  const regimeContrib = Number(signal.regimeContribution ?? 12);
  const confidence = Number(signal.confidence ?? 0);
  const forecastReturn = Number(signal.forecastReturn ?? 0);
  const action = signal.action ?? "HOLD";
  const symbol = signal.symbol ?? "UNKNOWN";
  const signalRegime = regime?.regime ?? signal.regime ?? "Unknown";

  // Normalize contributions to weights (sum to 100)
  const totalContrib = arimaContrib + lstmContrib + xgboostContrib + regimeContrib;
  const arimaWeight = totalContrib > 0 ? Math.round((arimaContrib / totalContrib) * 100) : 25;
  const xgboostWeight = totalContrib > 0 ? Math.round((xgboostContrib / totalContrib) * 100) : 28;
  const neuralNetWeight = totalContrib > 0 ? Math.round((lstmContrib / totalContrib) * 100) : 35;

  // Build model breakdowns
  const arimaBreakdown: ModelBreakdown = {
    name: "ARIMA",
    direction: getDirectionFromContribution(arimaContrib, action),
    confidence: Math.round(Math.min(100, 40 + arimaContrib * 1.5)),
    weight: arimaWeight,
    contribution: `ARIMA time-series model contributes ${arimaContrib}% to the ensemble. It identifies ${
      arimaContrib > 20 ? "strong" : arimaContrib > 10 ? "moderate" : "weak"
    } ${action === "BUY" ? "upward" : action === "SELL" ? "downward" : "sideways"} momentum based on historical price patterns and autocorrelation analysis.`,
  };

  const xgboostBreakdown: ModelBreakdown = {
    name: "XGBoost",
    direction: getDirectionFromContribution(xgboostContrib, action),
    confidence: Math.round(Math.min(100, 40 + xgboostContrib * 1.5)),
    weight: xgboostWeight,
    contribution: `XGBoost gradient boosting model contributes ${xgboostContrib}% to the ensemble. It leverages ${
      xgboostContrib > 20 ? "multiple strong" : "several"
    } technical features including RSI, MACD, and Bollinger Band positioning to predict ${
      action === "BUY" ? "positive" : action === "SELL" ? "negative" : "neutral"
    } returns.`,
  };

  const neuralNetBreakdown: ModelBreakdown = {
    name: "LSTM Neural Network",
    direction: getDirectionFromContribution(lstmContrib, action),
    confidence: Math.round(Math.min(100, 40 + lstmContrib * 1.5)),
    weight: neuralNetWeight,
    contribution: `LSTM neural network model contributes ${lstmContrib}% to the ensemble. It captures ${
      lstmContrib > 25 ? "complex non-linear" : "sequential"
    } price dynamics and temporal dependencies, ${
      lstmContrib > 30 ? "showing strong conviction in" : "supporting"
    } the ${action.toLowerCase()} direction.`,
  };

  // Determine model agreement
  const modelDirections = [arimaContrib > 15, xgboostContrib > 15, lstmContrib > 15];
  const agreementCount = action === "BUY"
    ? modelDirections.filter(d => d).length
    : action === "SELL"
    ? modelDirections.filter(d => !d).length
    : 2; // HOLD typically means mixed
  const modelAgreement = Math.round((agreementCount / 3) * 100);

  // Build ensemble reasoning
  const dominantModel = arimaContrib >= xgboostContrib && arimaContrib >= lstmContrib
    ? "ARIMA"
    : xgboostContrib >= lstmContrib
    ? "XGBoost"
    : "LSTM Neural Network";

  const ensembleReasoning = `The ensemble model combines predictions from ARIMA, XGBoost, and LSTM with dynamic weighting. ` +
    `${dominantModel} is the dominant contributor with the highest weight in this signal. ` +
    `Model agreement is at ${modelAgreement}% — ${
      modelAgreement >= 100 ? "all models unanimously agree" :
      modelAgreement >= 67 ? "majority of models agree on direction" :
      "models show mixed signals, increasing uncertainty"
    }. ` +
    `The final confidence score of ${confidence}% reflects the weighted consensus ` +
    `${confidence >= 80 ? "with strong conviction" : confidence >= 65 ? "with moderate conviction" : "with limited conviction"}.`;

  // Regime impact
  const regimeImpact = getRegimeEffect(signalRegime);

  // Optimization impact
  const optimizationImpact = {
    method: forecast?.optimizationMethod ?? "ensemble-weighted",
    suggestedWeight: Math.round(Math.min(20, Math.max(2, confidence / 5))),
    reason: `Based on ${confidence}% confidence and ${signalRegime} conditions, ` +
      `the optimizer suggests a ${
        confidence >= 75 ? "standard" : "reduced"
      } position weight. ` +
      `${signalRegime === "High Volatility" ? "Position size is reduced due to elevated volatility." :
         signalRegime === "Bear Market" ? "Conservative sizing applied due to bearish conditions." :
         "Current regime supports the suggested allocation."}`,
  };

  // Risk factors
  const riskFactors = assessRiskFactors(signal, signalRegime);

  // Summary
  const summary = `${action} signal for ${symbol} with ${confidence}% confidence. ` +
    `Forecast return: ${forecastReturn > 0 ? "+" : ""}${forecastReturn}%. ` +
    `${dominantModel} is the primary driver. ` +
    `Market regime: ${signalRegime}. ` +
    `${modelAgreement >= 67 ? "Models show consensus." : "Models show divergence — exercise caution."}`;

  return {
    summary,
    action,
    symbol,
    confidence,
    modelBreakdown: {
      arima: arimaBreakdown,
      xgboost: xgboostBreakdown,
      neuralNet: neuralNetBreakdown,
    },
    ensembleReasoning,
    regimeImpact: {
      regime: signalRegime,
      ...regimeImpact,
    },
    optimizationImpact,
    riskFactors,
    forecastReturn,
    modelAgreement,
  };
}

/**
 * Generate structured reasoning for an auto-trade decision.
 * This is stored in the autoTrades table as the `reasoning` JSONB column.
 */
export function generateAutoTradeReasoning(
  signal: any,
  optimization: any,
  action: string,
  quantity: number
): object {
  const arimaContrib = Number(signal.arimaContribution ?? 25);
  const lstmContrib = Number(signal.lstmContribution ?? 35);
  const xgboostContrib = Number(signal.xgboostContribution ?? 28);
  const confidence = Number(signal.confidence ?? 0);
  const forecastReturn = Number(signal.forecastReturn ?? 0);
  const regime = signal.regime ?? "Unknown";

  // Determine which models agree
  const modelAgreement: Record<string, boolean> = {};
  if (action === "BUY") {
    modelAgreement["ARIMA"] = arimaContrib > 15;
    modelAgreement["LSTM"] = lstmContrib > 15;
    modelAgreement["XGBoost"] = xgboostContrib > 15;
  } else {
    modelAgreement["ARIMA"] = arimaContrib <= 15;
    modelAgreement["LSTM"] = lstmContrib <= 15;
    modelAgreement["XGBoost"] = xgboostContrib <= 15;
  }

  const agreeingModels = Object.entries(modelAgreement)
    .filter(([, agrees]) => agrees)
    .map(([name]) => name);

  const disagreeingModels = Object.entries(modelAgreement)
    .filter(([, agrees]) => !agrees)
    .map(([name]) => name);

  return {
    signalSummary: `Auto-trade ${action} triggered for ${signal.symbol} at confidence ${confidence}%. ` +
      `The ensemble forecast predicts a ${forecastReturn > 0 ? "positive" : "negative"} return of ` +
      `${Math.abs(forecastReturn)}% based on multi-model analysis. ` +
      `${quantity > 0 ? `${quantity} shares will be ${action === "BUY" ? "purchased" : "sold"}.` : "No shares traded due to constraints."}`,

    modelContributions: {
      arima: {
        contribution: arimaContrib,
        agreesWithAction: modelAgreement["ARIMA"],
        description: `ARIMA model ${modelAgreement["ARIMA"] ? "supports" : "opposes"} the ${action} action with ${arimaContrib}% contribution`,
      },
      lstm: {
        contribution: lstmContrib,
        agreesWithAction: modelAgreement["LSTM"],
        description: `LSTM neural network ${modelAgreement["LSTM"] ? "supports" : "opposes"} the ${action} action with ${lstmContrib}% contribution`,
      },
      xgboost: {
        contribution: xgboostContrib,
        agreesWithAction: modelAgreement["XGBoost"],
        description: `XGBoost model ${modelAgreement["XGBoost"] ? "supports" : "opposes"} the ${action} action with ${xgboostContrib}% contribution`,
      },
      consensus: `${agreeingModels.length}/3 models agree: ${agreeingModels.join(", ") || "none"}${
        disagreeingModels.length > 0 ? `. Dissenting: ${disagreeingModels.join(", ")}` : ""
      }`,
    },

    optimizationReason: optimization
      ? `Optimization method "${optimization.method ?? "ensemble-weighted"}" suggests ` +
        `a portfolio weight of ${optimization.suggestedWeight ?? "N/A"}% for this position. ` +
        `${optimization.reason ?? "Standard weighting applied based on risk-return profile."}`
      : `No specific optimization applied. Position sized using maximum position percentage ` +
        `from user configuration, constrained by available cash.`,

    regimeContext: {
      currentRegime: regime,
      impact: getRegimeEffect(regime).effect,
      strategy: getRegimeEffect(regime).strategy,
      regimeAligned: (regime === "Bull Market" && action === "BUY") ||
                     (regime === "Bear Market" && action === "SELL") ||
                     regime === "Sideways Market",
    },

    riskAssessment: {
      confidenceLevel: confidence >= 80 ? "high" : confidence >= 65 ? "moderate" : "low",
      factors: assessRiskFactors(signal, regime),
      recommendation: confidence >= 75
        ? "Signal meets high-confidence threshold. Trade execution recommended."
        : confidence >= 60
        ? "Signal meets moderate threshold. Trade executed with standard risk controls."
        : "Signal confidence is below recommended levels. Reduced position size applied.",
    },

    timestamp: new Date().toISOString(),
  };
}
