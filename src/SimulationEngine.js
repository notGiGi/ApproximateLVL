// SimulationEngine.js - Complete simulation engine faithful to the paper
// "Coordination Through Stochastic Channels"

import Decimal from 'decimal.js';

// Configure decimal.js for high precision
Decimal.set({
  precision: 50,
  rounding: 4,
  toExpNeg: -30,
  toExpPos: 30,
  maxE: 9e15,
  minE: -9e15,
  modulo: 1,
  crypto: false
});

// Helper function to convert to Decimal safely
function toDecimal(value) {
  if (value instanceof Decimal) return value;
  if (typeof value === 'number' || typeof value === 'string') {
    return new Decimal(value);
  }
  return new Decimal(0);
}

// Helper function to generate random numbers using Decimal
function randomDecimal() {
  return new Decimal(Math.random());
}

// Helper function for powers with Decimal
function pow(base, exponent) {
  return toDecimal(base).pow(toDecimal(exponent));
}

// Helper function for absolute value
function abs(value) {
  return toDecimal(value).abs();
}

// Helper function for maximum
function max(...values) {
  return values.reduce((max, current) => {
    const decCurrent = toDecimal(current);
    return decCurrent.gt(max) ? decCurrent : max;
  }, toDecimal(values[0] || 0));
}

// Helper function for minimum
function min(...values) {
  return values.reduce((min, current) => {
    const decCurrent = toDecimal(current);
    return decCurrent.lt(min) ? decCurrent : min;
  }, toDecimal(values[0] || Infinity));
}

// Theta value for 3 players (approximately 0.35)
const THETA = 0.346;

// Simulation engine
export const SimulationEngine = {
  // Simulate one round of message exchange
// Simulate one round of message exchange
simulateRound: function(values, p, algorithm = "auto", meetingPoint = 0.5, knownValuesSets = null, originalValues = null) {
  if (algorithm === "auto") {
    const decP = toDecimal(p);
    algorithm = decP.gt(0.5) ? "AMP" : "FV";
  }
  
  const decP = toDecimal(p);
  const processCount = values.length;
  const newValues = [...values];
  const messages = [];
  const messageDelivery = [];
  
  // Para algoritmo MIN: usar valores originales si se proporcionan
  const valuesToSend = algorithm === "MIN" && originalValues ? originalValues : values;
  
  // Simular envío de mensajes
  for (let i = 0; i < processCount; i++) {
    const senderMessages = [];
    const deliveryStatus = [];
    
    for (let j = 0; j < processCount; j++) {
      if (i !== j) {
        const messageValue = valuesToSend[i];
        const delivered = randomDecimal().lte(decP);
        
        senderMessages.push({
          to: j,
          value: messageValue,
          delivered
        });
        
        deliveryStatus.push(delivered);
      }
    }
    
    messages.push(senderMessages);
    messageDelivery.push(deliveryStatus);
  }
  
  // Procesar mensajes recibidos y actualizar valores
  // Procesar mensajes recibidos y actualizar valores
  // IMPORTANTE: Para MIN, mantener los Sets existentes, NO crear nuevos
  // Procesar mensajes recibidos y actualizar valores
  let updatedKnownValuesSets;

  // Solo MIN y RECURSIVE AMP usan knownValuesSets
  if (algorithm === "MIN" || algorithm === "RECURSIVE AMP") {
    if (knownValuesSets) {
      // Ya tenemos Sets de rondas anteriores - mantenerlos (vienen como arrays)
      updatedKnownValuesSets = knownValuesSets.map(arr => new Set(arr));
    } else {
      // Primera ronda - inicializar con Sets vacíos
      updatedKnownValuesSets = Array(processCount).fill(null).map(() => new Set());
    }
  } else {
    // Otros algoritmos no usan knownValuesSets
    updatedKnownValuesSets = null;
  }
  
  for (let i = 0; i < processCount; i++) {
    const receivedMessages = [];
    
    // Recopilar mensajes recibidos
    for (let j = 0; j < processCount; j++) {
      if (i !== j) {
        const senderMessages = messages[j];
        const messageToI = senderMessages.find(msg => msg.to === i);
        
        if (messageToI && messageToI.delivered) {
          receivedMessages.push(messageToI.value);
          // Solo agregar a knownValuesSets si existe (para MIN y RECURSIVE AMP)
          if (updatedKnownValuesSets && updatedKnownValuesSets[i]) {
            updatedKnownValuesSets[i].add(messageToI.value);
          }
        }
      }
    }
    
    // Siempre conoce su propio valor
    // MIN: Siempre conoce su valor ORIGINAL (no el actual)
    // Siempre conoce su propio valor
    // MIN: Siempre conoce su valor ORIGINAL (no el actual)
    if (updatedKnownValuesSets && updatedKnownValuesSets[i]) {
      if (algorithm === "MIN" && originalValues) {
        updatedKnownValuesSets[i].add(originalValues[i]);
      } else {
        updatedKnownValuesSets[i].add(values[i]);
      }
    }   
    // NUEVOS ALGORITMOS PARA 3 PROCESOS
    if (processCount === 3 && ["COURTEOUS", "SELFISH", "CYCLIC", "BIASED0"].includes(algorithm)) {
      const heardValues = [...receivedMessages];
      const myValue = values[i];
      
      // Count how many unique processes we heard from (including self)
      const uniqueProcessesHeard = receivedMessages.length + 1; // +1 for self
      
      if (algorithm === "COURTEOUS") {
        // 1.a - If heard only own value (no messages received)
        if (receivedMessages.length === 0) {
          newValues[i] = myValue;
        }
        // 1.b - If heard from all 3 processes
        else if (uniqueProcessesHeard === 3) {
          const allValues = [myValue, ...receivedMessages];
          const count0 = allValues.filter(v => v === 0).length;
          const count1 = allValues.filter(v => v === 1).length;
          newValues[i] = count0 > count1 ? 0 : 1;
        }
        // 1.c - If heard exactly one value different from own
        else if (receivedMessages.length === 1 && receivedMessages[0] !== myValue) {
          newValues[i] = receivedMessages[0]; // Decide the opposite value
        }
        else {
          newValues[i] = myValue; // Default: keep own value
        }
      }
      else if (algorithm === "SELFISH") {
        // 2.a - If heard only own value (no messages received)
        if (receivedMessages.length === 0) {
          newValues[i] = myValue;
        }
        // 2.b - If heard from all 3 processes
        else if (uniqueProcessesHeard === 3) {
          const allValues = [myValue, ...receivedMessages];
          const count0 = allValues.filter(v => v === 0).length;
          const count1 = allValues.filter(v => v === 1).length;
          newValues[i] = count0 > count1 ? 0 : 1;
        }
        // 2.c - If heard exactly one value different from own
        else if (receivedMessages.length === 1 && receivedMessages[0] !== myValue) {
          newValues[i] = myValue; // Decide own value (selfish)
        }
        else {
          newValues[i] = myValue; // Default: keep own value
        }
      }
      else if (algorithm === "CYCLIC") {
        // 3.a - If heard only own value (no messages received)
        if (receivedMessages.length === 0) {
          newValues[i] = myValue;
        }
        // 3.b - If heard from all 3 processes
        else if (uniqueProcessesHeard === 3) {
          const allValues = [myValue, ...receivedMessages];
          const count0 = allValues.filter(v => v === 0).length;
          const count1 = allValues.filter(v => v === 1).length;
          newValues[i] = count0 > count1 ? 0 : 1;
        }
        // 3.c - If heard exactly from one process, value different from own
        else if (receivedMessages.length === 1 && receivedMessages[0] !== myValue) {
          // Cyclic order: A->B, B->C, C->A
          // Process IDs: 0=A, 1=B, 2=C
          const receivedFromPrev = (i === 0) ? 2 : (i - 1); // Who would send to me in cyclic order
          const receivedFromNext = (i === 2) ? 0 : (i + 1); // Who I send to in cyclic order
          
          // Check which process sent the message
          let senderProcess = -1;
          for (let j = 0; j < processCount; j++) {
            if (i !== j && messages[j].find(msg => msg.to === i && msg.delivered)) {
              senderProcess = j;
              break;
            }
          }
          
          // Apply cyclic rule based on sender
          if (senderProcess === receivedFromPrev) {
            // I'm the decider in this pair, adopt sender's value
            newValues[i] = receivedMessages[0];
          } else {
            // I'm the one who keeps my value in this pair
            newValues[i] = myValue;
          }
        }
        else {
          newValues[i] = myValue; // Default: keep own value
        }
      }
      else if (algorithm === "BIASED0") {
        // If heard 0 from anybody (including self), decide 0
        const allValues = [myValue, ...receivedMessages];
        newValues[i] = allValues.includes(0) ? 0 : 1;
      }
    }
    // ALGORITMOS ORIGINALES
    else if (algorithm === "AMP") {
      if (receivedMessages.length > 0) {
        const receivedDifferentValue = receivedMessages.find(val => val !== values[i]);
        if (receivedDifferentValue !== undefined) {
          newValues[i] = meetingPoint;
        }
      }
    }
    else if (algorithm === "FV") {
      if (receivedMessages.length > 0) {
        const receivedDifferentValue = receivedMessages.find(val => val !== values[i]);
        if (receivedDifferentValue !== undefined) {
          newValues[i] = receivedDifferentValue;
        }
      }
    }
    else if (algorithm === "MIN" && knownValuesSets) {
      newValues[i] = values[i];
    } else if (algorithm === "RECURSIVE AMP") {
      const knownVals = Array.from(updatedKnownValuesSets[i]);
      if (knownVals.length > 1) {
        const vmin = Math.min(...knownVals);
        const vmax = Math.max(...knownVals);
        const alpha = meetingPoint || 0.5;
        newValues[i] = vmin + alpha * (vmax - vmin);
      } else {
        // Si solo conoce su propio valor, mantenerlo
        newValues[i] = values[i];
      }
    }
  }
  
  // Calcular discrepancia
  let maxDiscrepancy = new Decimal(0);
  for (let i = 0; i < processCount; i++) {
    for (let j = i + 1; j < processCount; j++) {
      const disc = abs(toDecimal(newValues[i]).minus(toDecimal(newValues[j])));
      if (disc.gt(maxDiscrepancy)) {
        maxDiscrepancy = disc;
      }
    }
  }
  
  // Convertir Sets a Arrays antes de retornar
  // Convertir Sets a Arrays para serialización
  const knownValuesSetsAsArrays = updatedKnownValuesSets ? 
    updatedKnownValuesSets.map(set => Array.from(set)) : null;

  return {
    values: newValues,
    messages: messages,
    messageDelivery: messageDelivery,
    discrepancy: maxDiscrepancy.toNumber(),
    newValues: newValues,
    knownValuesSets: knownValuesSetsAsArrays
  };
},

  // Run a complete experiment
  runExperiment: function(initialValues, p, rounds = 1, algorithm = "auto", meetingPoint = 0.5) {
    let values = [...initialValues];
    const processCount = values.length;
    const processNames = [];
    
    // Para algoritmo MIN: mantener conjunto de valores conocidos y valores originales
    let knownValuesSets = null;
    const originalValues = [...initialValues];
    
    if (algorithm === "MIN") {
      // Validar que todos los valores sean positivos para MIN
      const hasNegativeValues = initialValues.some(v => v < 0);
      if (hasNegativeValues) {
        console.warn("MIN algorithm works best with non-negative values");
      }
      
      // Para MIN, el meeting point no se usa
      if (meetingPoint !== 0.5) {
        console.info("MIN algorithm ignores meeting point parameter");
      }
      
      // Inicializar conjuntos con el valor propio de cada proceso
      knownValuesSets = initialValues.map(val => new Set([val]));
    }
    
    // Generate process names
    for (let i = 0; i < processCount; i++) {
      if (i < 3) {
        processNames.push(["Alice", "Bob", "Charlie"][i]);
      } else {
        processNames.push(`Process${i+1}`);
      }
    }
    
    // Calculate initial discrepancy
    let initialDiscrepancy = new Decimal(0);
    for (let i = 0; i < processCount; i++) {
      for (let j = i+1; j < processCount; j++) {
        const discrepancy = abs(toDecimal(values[i]).minus(toDecimal(values[j])));
        if (discrepancy.gt(initialDiscrepancy)) {
          initialDiscrepancy = discrepancy;
        }
      }
    }
    
    // Simulation history
    const history = [{
      round: 0,
      values: [...values],
      processValues: values.reduce((obj, val, idx) => {
        obj[processNames[idx].toLowerCase()] = val;
        return obj;
      }, {}),
      discrepancy: initialDiscrepancy.toNumber(),
      messages: [],
      knownValuesSets: algorithm === "MIN" ? knownValuesSets.map(set => Array.from(set)) : null
    }];
    
    // Execute rounds
    for (let r = 1; r <= rounds; r++) {
      const result = SimulationEngine.simulateRound(
        values, 
        p, 
        algorithm, 
        meetingPoint,
        knownValuesSets,
        originalValues
      );
      
      values = result.newValues;
      // IMPORTANTE: Mantener knownValuesSets acumulado para MIN y RECURSIVE AMP
      if (algorithm === "MIN" || algorithm === "RECURSIVE AMP") {
        // Los knownValuesSets ya vienen como arrays desde simulateRound
        // Los guardamos para pasarlos a la siguiente ronda
        knownValuesSets = result.knownValuesSets;
      }
      
      // Para la última ronda de MIN, decidir valores finales
      if (algorithm === "MIN" && r === rounds) {
        // Cada proceso decide el mínimo de su conjunto
        for (let i = 0; i < processCount; i++) {
          const minValue = Math.min(...Array.from(knownValuesSets[i]));
          values[i] = minValue;
        }
        
        // Calcular discrepancia final
        let maxDiscrepancy = new Decimal(0);
        for (let i = 0; i < processCount; i++) {
          for (let j = i+1; j < processCount; j++) {
            const discrepancy = abs(toDecimal(values[i]).minus(toDecimal(values[j])));
            if (discrepancy.gt(maxDiscrepancy)) {
              maxDiscrepancy = discrepancy;
            }
          }
        }
        result.discrepancy = maxDiscrepancy.toNumber();
      }
      
      // Record results for this round
      history.push({
        round: r,
        values: [...values],
        processValues: values.reduce((obj, val, idx) => {
          obj[processNames[idx].toLowerCase()] = val;
          return obj;
        }, {}),
        discrepancy: result.discrepancy,
        messages: result.messages,
        messageDelivery: result.messageDelivery,
        knownValuesSets: result.knownValuesSets  // Ya viene como arrays desde simulateRound
      });
    }
    
    return history;
  },

  runMultipleConditionedExperiments: function(initialValues, p, rounds, repetitions, algorithm = "auto", meetingPoint = 0.5) {
    const allDiscrepancies = [];
    const allConditioningRates = [];
    
    for (let i = 0; i < repetitions; i++) {
      const history = this.runConditionedExperiment(initialValues, p, rounds, algorithm, meetingPoint);
      const finalDiscrepancy = history[history.length - 1].discrepancy;
      allDiscrepancies.push(finalDiscrepancy);
      allConditioningRates.push(history.conditioningRate || 0);
    }
    
    // Calcular estadísticas
    const mean = allDiscrepancies.reduce((a, b) => a + b, 0) / allDiscrepancies.length;
    const avgConditioningRate = allConditioningRates.reduce((a, b) => a + b, 0) / allConditioningRates.length;
    
    return {
      mean,
      min: Math.min(...allDiscrepancies),
      max: Math.max(...allDiscrepancies),
      avgConditioningRate,
      discrepancies: allDiscrepancies
    };
  },

  // Cálculo teórico para modo condicionado (Teoremas 4 y 7)
  calculateTheoreticalConditioned: function(p, algorithm = "auto", rounds = 1) {
    const decP = toDecimal(p);
    const q = toDecimal(1).minus(decP);
    
    if (algorithm === "auto") {
      algorithm = decP.gt(0.5) ? "AMP" : "FV";
    }
    
    // Fórmulas del paper para caso condicionado
    const qSquared = pow(q, 2);
    const oneMinusQSquared = toDecimal(1).minus(qSquared);
    
    let singleRoundFactor;
    if (algorithm === "AMP") {
      // E[D | at least one message] = pq / (1 - q²)
      const pq = decP.mul(q);
      singleRoundFactor = pq.div(oneMinusQSquared);
    } else {
      // E[D | at least one message] = p² / (1 - q²)
      const pSquared = pow(decP, 2);
      singleRoundFactor = pSquared.div(oneMinusQSquared);
    }
    
    // Para múltiples rondas: factor^rounds
    return pow(singleRoundFactor, rounds).toNumber();
  },


  // Run multiple experiments for statistical analysis
  runMultipleExperiments: function(initialValues, p, rounds, repetitions, algorithm = "auto", meetingPoint = 0.5) {
    const allDiscrepancies = [];
    const allRuns = [];
    const processCount = initialValues.length;
    const decP = toDecimal(p);
    
    // Determine actual algorithm if auto
    const actualAlgorithm = algorithm === "auto"
      ? (decP.gt(0.5) ? "AMP" : "FV")
      : algorithm;
    
    const actualMeetingPoint = meetingPoint;
    
    // Run multiple simulations
    for (let i = 0; i < repetitions; i++) {
      const history = SimulationEngine.runExperiment(
        initialValues,
        p,
        rounds,
        algorithm,
        actualMeetingPoint
      );
      
      const finalDiscrepancy = history[history.length - 1].discrepancy;
      allDiscrepancies.push(finalDiscrepancy);
      allRuns.push(history);
    }
    
    // Calculate statistics using Decimal
    const decDiscrepancies = allDiscrepancies.map(d => toDecimal(d));
    const mean = decDiscrepancies
      .reduce((sum, d) => sum.plus(d), new Decimal(0))
      .div(decDiscrepancies.length);
    
    const sorted = [...decDiscrepancies].sort((a, b) => a.minus(b).toNumber());
    const median = sorted.length % 2 === 0
      ? sorted[sorted.length / 2 - 1].plus(sorted[sorted.length / 2]).div(2)
      : sorted[Math.floor(sorted.length / 2)];
    
    const minVal = min(...decDiscrepancies);
    const maxVal = max(...decDiscrepancies);
    
    const variance = decDiscrepancies.length > 1
      ? decDiscrepancies
          .reduce((sum, d) => sum.plus(pow(d.minus(mean), 2)), new Decimal(0))
          .div(decDiscrepancies.length - 1)
      : new Decimal(0);
    const std = variance.sqrt();
    
    // Calculate theoretical discrepancy
    let theoretical = null;
    
    // Count number of processes with value 0
    let m = 0;
    initialValues.forEach(val => {
      if (val === 0) m++;
    });
    
    if (processCount === 2) {
      theoretical = this.calculateExpectedDiscrepancyMultiRound(
        p,
        rounds,
        actualAlgorithm
      );
    } else if (processCount === 3) {
      theoretical = this.calculateExpectedDiscrepancy3Players(p, initialValues, meetingPoint);
      if (rounds > 1) {
        const reductionFactor = this.getReductionFactor3Players(p);
        theoretical = theoretical * Math.pow(reductionFactor, rounds - 1);
      }
    } else {
      theoretical = this.calculateExpectedDiscrepancyNProcesses(
        p,
        processCount,
        m,
        actualAlgorithm,
        actualMeetingPoint
      );
      if (rounds > 1) {
        const q = toDecimal(1).minus(decP);
        const reductionFactor = actualAlgorithm === "AMP"
          ? q.toNumber()
          : (pow(decP, 2).plus(pow(q, 2))).toNumber();
        theoretical = theoretical * Math.pow(reductionFactor, rounds - 1);
      }
    }
    
    const se = std.toNumber() / Math.sqrt(repetitions);
    const ci95 = 2 * se;
    const theoSE = Math.sqrt(theoretical * (1 - theoretical) / repetitions);
    const theoCI95 = 2 * theoSE;
    
    return {
      mean: mean.toNumber(),
      median: median.toNumber(),
      min: minVal.toNumber(),
      max: maxVal.toNumber(),
      std: std.toNumber(),
      variance: variance.toNumber(),
      se,
      ci95,
      theoSE,
      theoCI95,
      allValues: allDiscrepancies,
      theoretical,
      algorithm: actualAlgorithm,
      processCount,
      allRuns,
      n: processCount,
      m: m
    };
  },

  // Calculate expected discrepancy for 2 processes
  calculateExpectedDiscrepancy: function(p, algorithm = "auto", rounds = 1, deliveryMode = 'standard') {
    const decP = toDecimal(p);
    const q = toDecimal(1).minus(decP);
    
    if (algorithm === "auto") {
      algorithm = decP.gt(0.5) ? "AMP" : "FV";
    }
    
    if (deliveryMode === 'guaranteed') {
      // Fórmulas de los Teoremas 4 y 7 (conditioned delivery)
      const qSquared = pow(q, 2);
      const oneMinusQSquared = toDecimal(1).minus(qSquared);
      
      let factor;
      if (algorithm === "AMP") {
        // E[D] = pq / (1 - q²)
        const pq = decP.mul(q);
        factor = pq.div(oneMinusQSquared);
      } else {
        // E[D] = p² / (1 - q²)
        const pSquared = pow(decP, 2);
        factor = pSquared.div(oneMinusQSquared);
      }
      
      // El factor máximo es 1/3
      const maxFactor = toDecimal(1).div(3);
      if (factor.gt(maxFactor)) {
        factor = maxFactor;
      }
      
      // Para múltiples rondas: factor^r
      return pow(factor, rounds).toNumber();
      
    } else {
      // Modo estándar (fórmulas originales)
      if (algorithm === "AMP") {
        return pow(q, rounds).toNumber();
      } else if (algorithm === "FV") {
        const pSquaredPlusQSquared = pow(decP, 2).plus(pow(q, 2));
        return pow(pSquaredPlusQSquared, rounds).toNumber();
      } else if (algorithm === "RECURSIVE AMP") {
        // Para recursive AMP, usar la misma fórmula que AMP estándar
        return pow(q, rounds).toNumber();
      } else if (algorithm === "COURTEOUS") {
        // Ecuación teórica para COURTEOUS (solo válida para 3 procesos)
        const pNum = decP.toNumber();
        const singleRoundDiscrepancy = 1 - 2*pNum + 4*Math.pow(pNum, 2) - 4*Math.pow(pNum, 3) + Math.pow(pNum, 4);
        return Math.pow(singleRoundDiscrepancy, rounds);
      } else {
        // Para otros algoritmos, devolver valor por defecto
        return 1;
      }
    }
  },
  
  // Calculate expected discrepancy for multiple rounds (2 processes)
  calculateExpectedDiscrepancyMultiRound: function(p, rounds, algorithm = "auto") {
    const decP = toDecimal(p);
    
    if (algorithm === "MIN" || algorithm === "RECURSIVE AMP") {
      return null;
    }
    
    if (algorithm === "auto") {
      algorithm = decP.gt(0.5) ? "AMP" : "FV";
    }
    
    const q = toDecimal(1).minus(decP);
    
    if (algorithm === "COURTEOUS") {
      const pNum = decP.toNumber();
      const singleRoundFactor = 1 - 2*pNum + 4*Math.pow(pNum, 2) - 4*Math.pow(pNum, 3) + Math.pow(pNum, 4);
      return Math.pow(singleRoundFactor, rounds);
    }

    if (algorithm === "AMP") {
      return pow(q, rounds).toNumber();
    } else {
      const pSquaredPlusQSquared = pow(decP, 2).plus(pow(q, 2));
      return pow(pSquaredPlusQSquared, rounds).toNumber();
    }

    
  },

  // Calculate expected discrepancy for 3 players according to paper
  calculateExpectedDiscrepancy3Players: function(p, initialValues, meetingPoint) {
    const decP = toDecimal(p);
    const q = toDecimal(1).minus(decP);
    
    if (decP.gte(0.5)) {
      return q.toNumber();
    } else if (decP.gte(THETA)) {
      const term1 = toDecimal(2).mul(decP).mul(pow(q, 2));
      const term2 = pow(decP, 3);
      const term3 = decP.mul(q).mul(toDecimal(1).minus(pow(q, 2)));
      const term4 = pow(decP, 2).mul(pow(q, 2));
      const term5 = pow(q, 2).mul(toDecimal(1).minus(pow(decP, 2)));
      
      return toDecimal(meetingPoint).mul(term1.plus(term2).plus(term3).plus(term4)).plus(term5).toNumber();
    } else {
      const term1 = decP.mul(toDecimal(1).minus(pow(decP, 2)));
      const term2 = pow(q, 2).mul(toDecimal(1).minus(decP.mul(q)));
      
      return term1.plus(term2).toNumber();
    }
  },

  // Get reduction factor for 3 players
  getReductionFactor3Players: function(p) {
    const decP = toDecimal(p);
    const q = toDecimal(1).minus(decP);
    
    if (decP.gte(0.5)) {
      return q.toNumber();
    } else if (decP.gte(THETA)) {
      return Math.max(q.toNumber(), (pow(decP, 2).plus(pow(q, 2))).toNumber());
    } else {
      return (pow(decP, 2).plus(pow(q, 2))).toNumber();
    }
  },

  // Calculate convergence rate
  calculateConvergenceRate: function(p, algorithm, rounds) {
    const decP = toDecimal(p);
    if (algorithm === "auto") {
      algorithm = decP.gt(0.5) ? "AMP" : "FV";
    }
    
    const q = toDecimal(1).minus(decP);
    const rates = [];
    
    for (let r = 1; r <= rounds; r++) {
      let theoreticalDiscrepancy, previousDiscrepancy;
      
      if (algorithm === "AMP") {
        theoreticalDiscrepancy = pow(q, r);
        previousDiscrepancy = pow(q, r-1);
      } else {
        const pSquaredPlusQSquared = pow(decP, 2).plus(pow(q, 2));
        theoreticalDiscrepancy = pow(pSquaredPlusQSquared, r);
        previousDiscrepancy = pow(pSquaredPlusQSquared, r-1);
      }
      
      const convergenceRate = previousDiscrepancy.gt(0) ? 
        toDecimal(1).minus(theoreticalDiscrepancy.div(previousDiscrepancy)) : new Decimal(0);
      
      rates.push({
        round: r,
        discrepancy: theoreticalDiscrepancy.toNumber(),
        convergenceRate: convergenceRate.toNumber(),
        reductionFactor: previousDiscrepancy.gt(0) ? 
          theoreticalDiscrepancy.div(previousDiscrepancy).toNumber() : 0
      });
    }
    
    return {
      probability: p,
      algorithm,
      theoreticalFactor: algorithm === "AMP" ? q.toNumber() : (pow(decP, 2).plus(pow(q, 2))).toNumber(),
      convergenceRates: rates
    };
  },

  // Calculate expected discrepancy for n processes
  calculateExpectedDiscrepancyNProcesses: function(p, n, m, algorithm = "auto", meetingPoint = 0.5) {
    const decP = toDecimal(p);
    const q = toDecimal(1).minus(decP);
    
    if (algorithm === "auto") {
      algorithm = decP.gt(0.5) ? "AMP" : "FV";
    }
    
    if (algorithm === "MIN" || algorithm === "RECURSIVE AMP") {
      return null;
    }
    
    const a = toDecimal(meetingPoint);
    
    if (algorithm === "AMP") {
      const A = pow(toDecimal(1).minus(pow(q, n-m)), m);
      const B = pow(toDecimal(1).minus(pow(q, m)), n-m);
      return toDecimal(1).minus(a.mul(A).plus(toDecimal(1).minus(a).mul(B))).toNumber();
    } else {
      const A = pow(toDecimal(1).minus(pow(q, n-m)), m);
      const B = pow(toDecimal(1).minus(pow(q, m)), n-m);
      const C = pow(q, m*(n-m));
      return toDecimal(1).minus(C.mul(A.plus(B))).toNumber();
    }
  },


  // Calculate expected discrepancy for 3-process binary algorithms
  calculate3ProcessBinaryDiscrepancy: function(p, algorithm, initialValues) {
    if (initialValues.length !== 3) return null;
    
    const q = 1 - p;
    const count0 = initialValues.filter(v => v === 0).length;
    const count1 = initialValues.filter(v => v === 1).length;
    
    switch(algorithm) {
      case "COURTEOUS":
        // Ecuación teórica EXACTA del paper para Courteous
        return 1 - 2*p + 4*Math.pow(p, 2) - 4*Math.pow(p, 3) + Math.pow(p, 4);
        
      case "SELFISH":
      case "CYCLIC":
      case "BIASED0":
        // Estos algoritmos NO tienen ecuaciones teóricas - retornar null
        return null;
        
      default:
        return null;
    }
  },

  // Run experiment with n processes
  runNProcessExperiment: function(initialValues, p, rounds, algorithm = "auto", meetingPoint = 0.5) {
    return this.runExperiment(initialValues, p, rounds, algorithm, meetingPoint);
  },

  // Run multiple experiments with n processes
  runMultipleNProcessExperiments: function(initialValues, p, rounds, repetitions, algorithm = "auto", meetingPoint = 0.5) {
    return this.runMultipleExperiments(initialValues, p, rounds, repetitions, algorithm, meetingPoint);
  },

  // Calculate theoretical variance
  calculateTheoreticalVariance: function(p, n, m, algorithm, rounds = 1) {
    const q = 1 - p;
    
    if (n === 2) {
      if (algorithm === "AMP") {
        const varOneRound = 0.5 * p * q;
        return varOneRound * Math.pow(q, rounds - 1);
      } else {
        const pSquaredPlusQSquared = p*p + q*q;
        const varOneRound = pSquaredPlusQSquared * (1 - pSquaredPlusQSquared);
        return varOneRound * Math.pow(pSquaredPlusQSquared, rounds - 1);
      }
    } else {
      if (algorithm === "AMP") {
        const baseVar = 0.25 * Math.sqrt(n/2);
        const pFactor = 4 * p * q;
        const varOneRound = baseVar * pFactor;
        return varOneRound * Math.pow(q, rounds - 1);
      } else {
        const pSquaredPlusQSquared = p*p + q*q;
        const baseVar = 0.3 * Math.sqrt(n/2);
        const pFactor = pSquaredPlusQSquared * (1 - pSquaredPlusQSquared);
        const varOneRound = baseVar * pFactor;
        return varOneRound * Math.pow(pSquaredPlusQSquared, rounds - 1);
      }
    }
  },
  // Función para ejecutar experimento con entrega garantizada
runConditionedExperiment: function(initialValues, p, rounds = 1, algorithm = "auto", meetingPoint = 0.5) {
    let values = [...initialValues];
    const processCount = values.length;
    const history = [];
    let conditionedRounds = 0;
    
    // Determinar nombres de procesos
    const processNames = [];
    for (let i = 0; i < processCount; i++) {
      if (i < 3) {
        processNames.push(["Alice", "Bob", "Charlie"][i]);
      } else {
        processNames.push(`Process${i+1}`);
      }
    }
    
    // Calcular discrepancia inicial
    let maxDiscrepancy = new Decimal(0);
    for (let i = 0; i < processCount; i++) {
      for (let j = i+1; j < processCount; j++) {
        const disc = abs(toDecimal(values[i]).minus(toDecimal(values[j])));
        if (disc.gt(maxDiscrepancy)) {
          maxDiscrepancy = disc;
        }
      }
    }
    
    // Agregar estado inicial
    history.push({
      round: 0,
      values: [...values],
      processValues: values.reduce((obj, val, idx) => {
        obj[processNames[idx].toLowerCase()] = val;
        return obj;
      }, {}),
      discrepancy: maxDiscrepancy.toNumber(),
      messages: [],
      wasConditioned: false
    });
    
    // Ejecutar rondas
    for (let r = 1; r <= rounds; r++) {
      const result = this.simulateRoundConditioned(values, p, algorithm, meetingPoint);
      
      values = result.newValues;
      if (result.wasConditioned) {
        conditionedRounds++;
      }
      
      history.push({
        round: r,
        values: [...values],
        processValues: values.reduce((obj, val, idx) => {
          obj[processNames[idx].toLowerCase()] = val;
          return obj;
        }, {}),
        discrepancy: result.discrepancy,
        messages: result.messages,
        messageDelivery: result.messageDelivery,
        wasConditioned: result.wasConditioned
      });
    }
    
    // Agregar estadísticas
    history.conditionedRounds = conditionedRounds;
    history.conditioningRate = conditionedRounds / rounds;
    
    return history;
  },

// Función para simular una ronda con entrega garantizada
simulateRoundConditioned: function(values, p, algorithm = "auto", meetingPoint = 0.5) {
    const decP = toDecimal(p);
    const processCount = values.length;
    const newValues = [...values];
    const messages = [];
    const messageDelivery = [];
    
    // Determinar algoritmo
    if (algorithm === "auto") {
      algorithm = decP.gt(0.5) ? "AMP" : "FV";
    }
    
    // PASO 1: Intentar entrega normal con probabilidad p
    let atLeastOneDelivered = false;
    
    for (let i = 0; i < processCount; i++) {
      messages[i] = [];
      messageDelivery[i] = [];
      
      for (let j = 0; j < processCount; j++) {
        if (i !== j) {
          const delivered = randomDecimal().lte(decP);
          messageDelivery[i].push(delivered);
          if (delivered) {
            messages[i].push(values[j]);
            atLeastOneDelivered = true;
          }
        }
      }
    }
    
    // PASO 2: Si no se entregó ningún mensaje, entregar exactamente uno
    let wasConditioned = false;
    if (!atLeastOneDelivered) {
      wasConditioned = true;
      
      // Elegir uniformemente emisor y receptor
      const sender = Math.floor(Math.random() * processCount);
      let receiver = Math.floor(Math.random() * processCount);
      while (receiver === sender) {
        receiver = Math.floor(Math.random() * processCount);
      }
      
      // Entregar el mensaje
      messages[receiver] = [values[sender]];
      // Actualizar matriz de entrega
      if (processCount === 2) {
        messageDelivery[receiver][0] = true;
      } else {
        const index = sender < receiver ? sender : sender - 1;
        messageDelivery[receiver][index] = true;
      }
    }
    
    // PASO 3: Aplicar el algoritmo según definición del paper
    for (let i = 0; i < processCount; i++) {
      const receivedMessages = messages[i];
      
      if (receivedMessages.length > 0) {
        if (algorithm === "AMP") {
          // AMP: si recibe valor diferente, va al meeting point
          const differentValue = receivedMessages.find(val => val !== values[i]);
          if (differentValue !== undefined) {
            newValues[i] = meetingPoint;
          }
        } else if (algorithm === "FV") {
          // FV: adopta el primer valor diferente que recibe
          const differentValues = receivedMessages.filter(val => val !== values[i]);
          if (differentValues.length > 0) {
            newValues[i] = differentValues[0];
          }
        }
      }
    }
    
    // PASO 4: Calcular discrepancia
    let maxDiscrepancy = new Decimal(0);
    for (let i = 0; i < processCount; i++) {
      for (let j = i+1; j < processCount; j++) {
        const disc = abs(toDecimal(newValues[i]).minus(toDecimal(newValues[j])));
        if (disc.gt(maxDiscrepancy)) {
          maxDiscrepancy = disc;
        }
      }
    }
    
    return {
      newValues,
      messages,
      messageDelivery,
      discrepancy: maxDiscrepancy.toNumber(),
      wasConditioned
    };
  },

  // Calculate theoretical CV
  calculateTheoreticalCV: function(p, n, m, algorithm, meetingPoint, rounds = 1) {
    const expectedD = this.calculateExpectedDiscrepancyNProcesses(p, n, m, algorithm, meetingPoint);
    const variance = this.calculateTheoreticalVariance(p, n, m, algorithm, rounds);
    const stdDev = Math.sqrt(variance);
    
    if (expectedD === 0) return Infinity;
    return stdDev / Math.abs(expectedD);
  },

  // Calculate expected relative error
  calculateExpectedRelativeError: function(p, n, m, algorithm, rounds, repetitions) {
    const cv = this.calculateTheoreticalCV(p, n, m, algorithm, rounds);
    return cv / Math.sqrt(repetitions);
  },

  // Identify high error zones
  identifyHighErrorZones: function(minP, maxP, n, m, algorithm, rounds, repetitions, threshold = 0.2) {
    const zones = [];
    const steps = 100;
    const stepSize = (maxP - minP) / steps;
    
    for (let i = 0; i <= steps; i++) {
      const p = minP + i * stepSize;
      const expectedRelError = this.calculateExpectedRelativeError(p, n, m, algorithm, rounds, repetitions);
      
      if (expectedRelError > threshold) {
        if (zones.length === 0 || p - zones[zones.length - 1].end > stepSize * 2) {
          zones.push({ start: p, end: p, maxError: expectedRelError });
        } else {
          zones[zones.length - 1].end = p;
          zones[zones.length - 1].maxError = Math.max(zones[zones.length - 1].maxError, expectedRelError);
        }
      }
    }
    
    return zones;
  },


  simulateRoundConditioned: function(values, p, algorithm = "auto", meetingPoint = 0.5) {
    const decP = toDecimal(p);
    const processCount = values.length;
    const newValues = [...values];
    const messages = [];
    const messageDelivery = [];
    
    if (algorithm === "auto") {
      algorithm = decP.gt(0.5) ? "AMP" : "FV";
    }
    
    // PASO 1: Generar entregas de mensajes NORMALMENTE con probabilidad p
    let totalDelivered = 0;
    
    for (let i = 0; i < processCount; i++) {
      messages[i] = [];
      messageDelivery[i] = [];
      
      for (let j = 0; j < processCount; j++) {
        if (i !== j) {
          const delivered = randomDecimal().lte(decP);
          messageDelivery[i].push(delivered);
          if (delivered) {
            messages[i].push(values[j]);
            totalDelivered++;
          }
        }
      }
    }
    
    // PASO 2: CONDICIÓN - Si NO se entregó ningún mensaje, entregar exactamente UNO
    let wasConditioned = false;
    if (totalDelivered === 0) {
      wasConditioned = true;
      
      // Elegir aleatoriamente qué mensaje entregar
      if (processCount === 2) {
        // Para 2 procesos: 50/50 de probabilidad para cada dirección
        if (Math.random() < 0.5) {
          // Alice -> Bob
          messages[1] = [values[0]];
          messageDelivery[1][0] = true;
        } else {
          // Bob -> Alice
          messages[0] = [values[1]];
          messageDelivery[0][0] = true;
        }
      } else {
        // Para n procesos: elegir emisor y receptor uniformemente
        const sender = Math.floor(Math.random() * processCount);
        let receiver = Math.floor(Math.random() * processCount);
        while (receiver === sender) {
          receiver = Math.floor(Math.random() * processCount);
        }
        messages[receiver].push(values[sender]);
        const index = sender < receiver ? sender : sender - 1;
        messageDelivery[receiver][index] = true;
      }
    }
    
    // PASO 3: Aplicar el algoritmo EXACTAMENTE como está definido
    for (let i = 0; i < processCount; i++) {
      const receivedMessages = messages[i];
      
      if (algorithm === "AMP" && receivedMessages.length > 0) {
        const differentValue = receivedMessages.find(val => val !== values[i]);
        if (differentValue !== undefined) {
          newValues[i] = meetingPoint;
        }
      } else if (algorithm === "FV" && receivedMessages.length > 0) {
        const differentValues = receivedMessages.filter(val => val !== values[i]);
        if (differentValues.length > 0) {
          newValues[i] = differentValues[0];
        }
      }
    }
    
    // PASO 4: Calcular discrepancia SIN NINGÚN LÍMITE ARTIFICIAL
    let maxDiscrepancy = new Decimal(0);
    for (let i = 0; i < processCount; i++) {
      for (let j = i+1; j < processCount; j++) {
        const disc = abs(toDecimal(newValues[i]).minus(toDecimal(newValues[j])));
        if (disc.gt(maxDiscrepancy)) {
          maxDiscrepancy = disc;
        }
      }
    }
    

    
    return {
      newValues,
      messages,
      messageDelivery,
      discrepancy: maxDiscrepancy.toNumber(), 
      wasConditioned,
      totalDelivered: wasConditioned ? 1 : totalDelivered
    };
  },

 
  calculateExpectedDiscrepancyConditioned: function(p, algorithm = "auto", rounds = 1) {
    const decP = toDecimal(p);
    const q = toDecimal(1).minus(decP);
    
    if (algorithm === "auto") {
      algorithm = decP.gt(0.5) ? "AMP" : "FV";
    }
    
    // Fórmulas EXACTAS del Teorema 4 y 7
    const qSquared = pow(q, 2);
    const oneMinusQSquared = toDecimal(1).minus(qSquared);
    
    let singleRoundFactor;
    
    if (algorithm === "AMP") {
      // E[D | at least one message] = pq / (1 - q²)
      const pq = decP.mul(q);
      singleRoundFactor = pq.div(oneMinusQSquared);
    } else {
      // E[D | at least one message] = p² / (1 - q²)
      const pSquared = pow(decP, 2);
      singleRoundFactor = pSquared.div(oneMinusQSquared);
    }
    


    return pow(singleRoundFactor, rounds).toNumber();
  },


  calculateExpectedDiscrepancy: function(p, algorithm = "auto", rounds = 1, deliveryMode = 'standard') {
    const decP = toDecimal(p);
    const q = toDecimal(1).minus(decP);
    
    if (algorithm === "auto") {
      algorithm = decP.gt(0.5) ? "AMP" : "FV";
    }
    
    if (deliveryMode === 'guaranteed' || deliveryMode === 'conditioned') {
      // Usar el cálculo condicionado honesto
      return this.calculateExpectedDiscrepancyConditioned(p, algorithm, rounds);
    } else {
      // Modo estándar (fórmulas originales)
      if (algorithm === "AMP") {
        return pow(q, rounds).toNumber();
      } else if (algorithm === "FV") {
        const pSquaredPlusQSquared = pow(decP, 2).plus(pow(q, 2));
        return pow(pSquaredPlusQSquared, rounds).toNumber();
      } else {
        return 1;
      }
    }
  },

  // Función de análisis para entender qué está pasando
  analyzeConditionedBehavior: function() {
    console.log("=== Analyzing Conditioned Behavior (HONEST) ===");
    
    const testPoints = [0.1, 0.2, 0.3, 0.4, 0.5, 0.54, 0.6, 0.7, 0.8, 0.9];
    
    console.log("Theoretical values (NO ARTIFICIAL CAPS):");
    testPoints.forEach(p => {
      const algorithm = p > 0.5 ? "AMP" : "FV";
      const q = 1 - p;
      
      let factor;
      if (algorithm === "AMP") {
        factor = (p * q) / (1 - q * q);
      } else {
        factor = (p * p) / (1 - q * q);
      }
      
      console.log(`p=${p.toFixed(2)}, algo=${algorithm}, E[D|≥1 msg]=${factor.toFixed(4)}`);
    });
    
 
    let maxP = 0;
    let maxValue = 0;
    for (let p = 0.01; p <= 0.99; p += 0.01) {
      const algorithm = p > 0.5 ? "AMP" : "FV";
      const q = 1 - p;
      
      let value;
      if (algorithm === "AMP") {
        value = (p * q) / (1 - q * q);
      } else {
        value = (p * p) / (1 - q * q);
      }
      
      if (value > maxValue) {
        maxValue = value;
        maxP = p;
      }
    }
    
    console.log(`\nMaximum NATURAL value: ${maxValue.toFixed(4)} at p=${maxP.toFixed(2)}`);
    console.log("Theorem claims maximum is 1/3 = 0.3333");
    
    if (Math.abs(maxValue - 1/3) > 0.01) {
      console.log("⚠️ Natural maximum differs from theoretical claim!");
    } else {
      console.log("✅ Natural maximum matches theoretical claim");
    }
  },


  runHonestExperimentalTest: function(p = 0.54, repetitions = 1000) {
    console.log(`=== Honest Experimental Test at p=${p} ===`);
    
    const results = [];
    let conditionedCount = 0;
    
    for (let i = 0; i < repetitions; i++) {
      const result = this.simulateRoundConditioned(
        [0, 1], // valores iniciales
        p,
        "auto",
        0.5
      );
      
      results.push(result.discrepancy);
      if (result.wasConditioned) {
        conditionedCount++;
      }
    }
    
    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    const max = Math.max(...results);
    const min = Math.min(...results);
    const theoretical = this.calculateExpectedDiscrepancyConditioned(p, "auto", 1);
    
    console.log(`Algorithm: ${p > 0.5 ? 'AMP' : 'FV'}`);
    console.log(`Experimental Average: ${avg.toFixed(4)}`);
    console.log(`Theoretical (conditioned): ${theoretical.toFixed(4)}`);
    console.log(`Min: ${min.toFixed(4)}, Max: ${max.toFixed(4)}`);
    console.log(`Times conditioned: ${conditionedCount}/${repetitions} (${(conditionedCount/repetitions*100).toFixed(1)}%)`);
    
    const error = Math.abs(avg - theoretical) / theoretical * 100;
    console.log(`Error: ${error.toFixed(1)}%`);
    
    return {
      p,
      experimental: avg,
      theoretical,
      error,
      conditioningRate: conditionedCount / repetitions
    };
  },


  calculateTheoreticalConditionedDiscrepancy: function(p, algorithm = "auto", rounds = 1) {
    const decP = toDecimal(p);
    const q = toDecimal(1).minus(decP);

    if (algorithm === "auto") {
      algorithm = decP.gt(0.5) ? "AMP" : "FV";
    }

    const probAtLeastOne = toDecimal(1).minus(pow(q, 2));

    let singleRoundFactor;
    if (algorithm === "AMP") {
      const pq = decP.mul(q);
      singleRoundFactor = pq.div(probAtLeastOne);
    } else {
      const pSquared = pow(decP, 2);
      singleRoundFactor = pSquared.div(probAtLeastOne);
    }

    return pow(singleRoundFactor, rounds).toNumber();
  },

simulateRoundWithConditioning: function(values, p, algorithm = "auto", meetingPoint = 0.5, minK = 1) {
  const n = values.length;
  const decP = toDecimal(p);
  const EPS = 1e-12;

  // Resolver algoritmo real
  let algo = algorithm;
  if (algo === "auto") {
    algo = decP.gt(0.5) ? "AMP" : "FV";
  }

  // K (mínimo de mensajes entregados)
  const K = Math.max(1, Math.floor(minK));
  const M = n * (n - 1); // número total de posibles mensajes dirigidos

  // ---- CASO ESPECIAL EXACTO: n=2 y K=1 (teoremas 4/7) ----
  if (n === 2 && K === 1) {
    const q = toDecimal(1).minus(decP);

    if (p <= 0 || p >= 1) {
      // Degenerado: usa la simulación normal
      const res = this.simulateRound(values, p, algo, meetingPoint);
      res.wasConditioned = true;
      res.attemptCount = 1;
      res.conditioningK = K;
      return res;
    }

    // Muestreo exacto condicionado a "≥1 mensaje"
    const Z = toDecimal(1).minus(q.mul(q)); // 1 - q^2
    const wOnlyAB = decP.mul(q).div(Z).toNumber(); // P(solo A→B | ≥1)
    const wOnlyBA = q.mul(decP).div(Z).toNumber(); // P(solo B→A | ≥1)
    // P(ambos | ≥1) = 1 - wOnlyAB - wOnlyBA

    const r = Math.random();
    let aliceToBob = false;
    let bobToAlice = false;

    if (r < wOnlyAB) {
      aliceToBob = true;
    } else if (r < wOnlyAB + wOnlyBA) {
      bobToAlice = true;
    } else {
      aliceToBob = true;
      bobToAlice = true;
    }

   
    const a = toDecimal(meetingPoint).toNumber();
    const vmin = Math.min(values[0], values[1]);
    const vmax = Math.max(values[0], values[1]);
    const vrange = vmax - vmin;
    const meetingAbs = vrange > EPS ? (vmin + a * vrange) : values[0];

    // Dinámica
    let newValues = [...values];
    if (algo === "AMP") {
      if (bobToAlice && Math.abs(values[1] - values[0]) > EPS) newValues[0] = meetingAbs;
      if (aliceToBob && Math.abs(values[0] - values[1]) > EPS) newValues[1] = meetingAbs;
    } else if (algo === "FV") {
      if (bobToAlice && Math.abs(values[1] - values[0]) > EPS) newValues[0] = values[1];
      if (aliceToBob && Math.abs(values[0] - values[1]) > EPS) newValues[1] = values[0];
    }

    return {
      newValues,
      messages: [
        [{ to: 1, value: values[0], delivered: aliceToBob }],
        [{ to: 0, value: values[1], delivered: bobToAlice }]
      ],
      messageDelivery: [[bobToAlice],[aliceToBob]],
      discrepancy: Math.abs(newValues[0] - newValues[1]),
      knownValuesSets: [
        Array.from(new Set([values[0], bobToAlice ? values[1] : values[0]])).sort((a,b)=>a-b),
        Array.from(new Set([values[1], aliceToBob ? values[0] : values[1]])).sort((a,b)=>a-b)
      ],
      wasConditioned: true,
      attemptCount: 1,
      conditioningK: K
    };
  }

  // ---- CASO ESPECIAL EXACTO: K = M (TODOS los mensajes entregados) ----
  if (K >= M) {
    const messages = [];
    const messageDelivery = [];
    for (let i = 0; i < n; i++) {
      const senderMsgs = [];
      const row = [];
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        senderMsgs.push({ to: j, value: values[i], delivered: true });
        row.push(true);
      }
      messages.push(senderMsgs);
      messageDelivery.push(row);
    }

    const a = toDecimal(meetingPoint).toNumber();
    const gmin = Math.min(...values);
    const gmax = Math.max(...values);
    const gRange = gmax - gmin;
    const meetingAbs = gRange === 0 ? gmin : (gmin + a * gRange);

    const receivedBy = Array.from({ length: n }, () => []);
    for (let s = 0; s < n; s++) {
      for (const m of messages[s]) {
        receivedBy[m.to].push(m.value);
      }
    }

    const newValues = [...values];
    for (let i = 0; i < n; i++) {
      const rec = receivedBy[i];
      if (algo === "AMP") {
        if (rec.some(v => Math.abs(v - values[i]) > EPS)) newValues[i] = meetingAbs;
      } else if (algo === "FV") {
        const diff = rec.find(v => Math.abs(v - values[i]) > EPS);
        if (diff !== undefined) newValues[i] = diff;
      } else if (algo === "RECURSIVE AMP") {
        const kmin = Math.min(values[i], ...rec);
        const kmax = Math.max(values[i], ...rec);
        const kr = kmax - kmin;
        newValues[i] = kr > EPS ? (kmin + a * kr) : values[i];
      } else if (algo === "MIN") {
        // sin cambio
      }
    }

    let maxDisc = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const d = Math.abs(newValues[i] - newValues[j]);
      if (d > maxDisc) maxDisc = d;
    }

    const knownRound = [];
    for (let i = 0; i < n; i++) {
      const set = new Set([values[i], ...receivedBy[i]]);
      knownRound.push(Array.from(set).sort((x, y) => x - y));
    }

    return {
      newValues,
      messages,
      messageDelivery,
      discrepancy: maxDisc,
      knownValuesSets: knownRound,
      wasConditioned: true,
      attemptCount: 1,
      conditioningK: M
    };
  }

  // ---- CASO GENERAL (n>2 o 2 con K>1): Rejection sampling (≥K) ----

  const drawOnce = () => {
    const messages = [];
    const messageDelivery = [];
    for (let i = 0; i < n; i++) {
      const senderMsgs = [];
      const row = [];
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const delivered = Math.random() <= p;
        senderMsgs.push({ to: j, value: values[i], delivered });
        row.push(delivered);
      }
      messages.push(senderMsgs);
      messageDelivery.push(row);
    }
    return { messages, messageDelivery };
  };

  const countDelivered = (msgs) => {
    let c = 0;
    for (const arr of msgs) for (const m of arr) if (m.delivered) c++;
    return c;
  };

  const applyDynamics = (msgs) => {
    const a = toDecimal(meetingPoint).toNumber();
    const gmin = Math.min(...values);
    const gmax = Math.max(...values);
    const gRange = gmax - gmin;
    const meetingAbs = gRange === 0 ? gmin : (gmin + a * gRange);

    const receivedBy = Array.from({ length: n }, () => []);
    for (let s = 0; s < n; s++) for (const m of msgs[s]) if (m.delivered) receivedBy[m.to].push(m.value);

    const out = [...values];
    for (let i = 0; i < n; i++) {
      const rec = receivedBy[i];

      if (algo === "MIN") {
        out[i] = values[i];
        continue;
      }
      if (algo === "RECURSIVE AMP") {
        if (rec.length > 0) {
          const kmin = Math.min(values[i], ...rec);
          const kmax = Math.max(values[i], ...rec);
          const kr = kmax - kmin;
          out[i] = kr > EPS ? (kmin + a * kr) : values[i];
        }
        continue;
      }
      if (algo === "AMP") {
        if (rec.some(v => Math.abs(v - values[i]) > EPS)) out[i] = meetingAbs;
        continue;
      }
      if (algo === "FV") {
        const diff = rec.find(v => Math.abs(v - values[i]) > EPS);
        if (diff !== undefined) out[i] = diff;
        continue;
      }
    }

    let maxDisc = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const d = Math.abs(out[i] - out[j]);
      if (d > maxDisc) maxDisc = d;
    }

    const knownRound = [];
    for (let i = 0; i < n; i++) {
      const set = new Set([values[i]]);
      for (const arr of msgs) for (const m of arr) if (m.delivered && m.to === i) set.add(m.value);
      knownRound.push(Array.from(set).sort((x, y) => x - y));
    }

    return { newValues: out, discrepancy: maxDisc, knownRound };
  };

  // Probabilidad aproximada de aceptación P(X≥K) para X~Bin(M,p)
  const mu = M * p;
  const v = M * p * (1 - p);
  const approxPgeK = (() => {
    if (v < 1e-12) return (mu + 1e-12) >= K ? 1 : 0;
    const sigma = Math.sqrt(v);
    const z = (K - 0.5 - mu) / sigma;
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
    let Phi = 1 - d * (0.319381530*t - 0.356563782*t*t + 1.781477937*t*t*t
                       - 1.821255978*t*t*t*t + 1.330274429*t*t*t*t*t);
    if (z < 0) Phi = 1 - Phi;
    return Math.max(0, Math.min(1, 1 - Phi));
  })();


  const targetSuccess = 0.99;
  const needed = approxPgeK > 0 ? Math.ceil(Math.log(1 - targetSuccess) / Math.log(1 - approxPgeK)) : Infinity;
  const MAX_ATTEMPTS = Number.isFinite(needed) ? Math.max(needed, 50) : 50_000;
  const HARD_CAP = 200_000;
  const LIMIT = Math.min(MAX_ATTEMPTS, HARD_CAP);

  let last = null;
  for (let attempt = 1; attempt <= LIMIT; attempt++) {
    const draw = drawOnce();
    last = draw;
    if (countDelivered(draw.messages) >= K) {
      const dyn = applyDynamics(draw.messages);
      return {
        newValues: dyn.newValues,
        messages: draw.messages,
        messageDelivery: draw.messageDelivery,
        discrepancy: dyn.discrepancy,
        knownValuesSets: dyn.knownRound,
        wasConditioned: true,
        attemptCount: attempt,
        conditioningK: K
      };
    }
  }


  const dyn = applyDynamics(last ? last.messages : Array.from({length:n}, ()=>[]));
  return {
    newValues: dyn.newValues,
    messages: last ? last.messages : [],
    messageDelivery: last ? last.messageDelivery : [],
    discrepancy: dyn.discrepancy,
    knownValuesSets: dyn.knownRound,
    wasConditioned: false,
    attemptCount: LIMIT,
    conditioningK: K
  };
},





  runConditionedExperiments: function(initialValues, p, rounds, repetitions, algorithm = "auto", meetingPoint = 0.5) {
    if (initialValues.length !== 2) {
      throw new Error("Conditioned experiments only defined for 2 processes");
    }

    const results = [];
    const attemptCounts = [];

    for (let rep = 0; rep < repetitions; rep++) {
      let values = [...initialValues];
      let totalAttempts = 0;

      for (let r = 0; r < rounds; r++) {
        const roundResult = this.simulateRoundWithConditioning(values, p, algorithm, meetingPoint);
        values = roundResult.newValues;
        totalAttempts += roundResult.attemptCount;
      }

      const finalDiscrepancy = Math.abs(values[0] - values[1]);
      results.push(finalDiscrepancy);
      attemptCounts.push(totalAttempts);
    }

    const mean = results.reduce((a, b) => a + b, 0) / results.length;
    const theoretical = this.calculateTheoreticalConditionedDiscrepancy(p, algorithm, rounds);
    const variance = results.length > 1
      ? results.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (results.length - 1)
      : 0;
    const std = Math.sqrt(variance);

    const avgAttempts = attemptCounts.reduce((a, b) => a + b, 0) / attemptCounts.length;
    const avgAttemptsPerRound = avgAttempts / rounds;

    const q = 1 - p;
    const theoreticalAttemptsPerRound = 1 / (1 - q * q);

    const relativeError = (theoretical !== 0)
      ? Math.abs(mean - theoretical) / Math.abs(theoretical)
      : Math.abs(mean - theoretical);

    return {
      mean,
      theoretical,
      std,
      min: Math.min(...results),
      max: Math.max(...results),
      relativeError,
      avgAttemptsPerRound,
      theoreticalAttemptsPerRound,
      allValues: results,
      algorithm: algorithm === "auto" ? (p > 0.5 ? "AMP" : "FV") : algorithm
    };
  },


  compareStandardVsConditioned_T47: function(p, rounds = 1) {
    const q = 1 - p;
    const algorithm = p > 0.5 ? "AMP" : "FV";

    const standardFactor = (algorithm === "AMP") ? q : (p * p + q * q);
    const standardDiscrepancy = Math.pow(standardFactor, rounds);

    const conditionedDiscrepancy = this.calculateTheoreticalConditionedDiscrepancy(p, algorithm, rounds);
    const probConditionMet = Math.pow(1 - q * q, rounds);

    return {
      p,
      algorithm,
      rounds,
      standard: { factor: standardFactor, discrepancy: standardDiscrepancy },
      conditioned: {
        factor: (rounds === 1) ? conditionedDiscrepancy : Math.pow(conditionedDiscrepancy, 1 / rounds),
        discrepancy: conditionedDiscrepancy,
        maxPossible: Math.pow(1/3, rounds),
        probConditionMet
      },
      improvement: (conditionedDiscrepancy !== 0) ? (standardDiscrepancy / conditionedDiscrepancy) : Infinity
    };
  },

isBarycentricMatrix(values) {
  return Array.isArray(values) &&
         values.length > 0 &&
         Array.isArray(values[0]) &&
         typeof values[0][0] === 'number' &&
         values.every(row =>
           Array.isArray(row) &&
           this.barycentric.isValidBarycentric(row)
         );
},


runExperimentAutoSpace(initialValues, p, rounds = 1, algorithm = "auto", meetingPoint = 0.5) {
  if (this.isBarycentricMatrix(initialValues)) {
    return this.barycentric.runBarycentricExperiment(initialValues, p, rounds, algorithm, meetingPoint);
  }
  return this.runExperiment(initialValues, p, rounds, algorithm, meetingPoint);
},

runMultipleExperimentsAutoSpace(initialValues, p, rounds, repetitions, algorithm = "auto", meetingPoint = 0.5) {
  if (this.isBarycentricMatrix(initialValues)) {
    return this.barycentric.runMultipleBarycentricExperiments(initialValues, p, rounds, repetitions, algorithm, meetingPoint);
  }
  return this.runMultipleExperiments(initialValues, p, rounds, repetitions, algorithm, meetingPoint);
},



  multidimensional: {
    // ===== UTILIDADES =====
    euclideanDistance(a, b) {
      if (!Array.isArray(a) || !Array.isArray(b)) return 0;
      const dim = Math.max(a.length, b.length);
      let sum = 0;
      for (let i = 0; i < dim; i++) {
        const diff = (a[i] || 0) - (b[i] || 0);
        sum += diff * diff;
      }
      return Math.sqrt(sum);
    },
    l1Distance(a, b) {
      if (!Array.isArray(a) || !Array.isArray(b)) return 0;
      const dim = Math.max(a.length, b.length);
      let sum = 0;
      for (let i = 0; i < dim; i++) {
        sum += Math.abs((a[i] || 0) - (b[i] || 0));
      }
      return sum;
    },
    lInfDistance(a, b) {
      if (!Array.isArray(a) || !Array.isArray(b)) return 0;
      const dim = Math.max(a.length, b.length);
      let maxDiff = 0;
      for (let i = 0; i < dim; i++) {
        const diff = Math.abs((a[i] || 0) - (b[i] || 0));
        if (diff > maxDiff) maxDiff = diff;
      }
      return maxDiff;
    },
    calculateDiscrepancy(values, metric = 'euclidean') {
      if (!values || values.length < 2) return 0;
      const distanceFn =
        metric === 'l1' ? this.l1Distance.bind(this) :
        metric === 'linf' ? this.lInfDistance.bind(this) :
        this.euclideanDistance.bind(this);
      let maxDiscrepancy = 0;
      for (let i = 0; i < values.length; i++) {
        for (let j = i + 1; j < values.length; j++) {
          const d = distanceFn(values[i], values[j]);
          if (d > maxDiscrepancy) maxDiscrepancy = d;
        }
      }
      return maxDiscrepancy;
    },
    areDifferent(a, b, epsilon = 1e-10) {
      return this.euclideanDistance(a, b) > epsilon;
    },
    cloneVector(v) {
      return Array.isArray(v) ? [...v] : v;
    },
    cloneMatrix(matrix) {
      return matrix.map(v => this.cloneVector(v));
    },



    finalizeMultiMIN(knownValuesArray) {
    if (!knownValuesArray || knownValuesArray.length === 0) return null;
    if (knownValuesArray.length === 1) return this.cloneVector(knownValuesArray[0]);


    let minVal = knownValuesArray[0];
    let minSum = this.sumCoords(minVal);

    for (let i = 1; i < knownValuesArray.length; i++) {
      const currentSum = this.sumCoords(knownValuesArray[i]);
      
      if (currentSum < minSum || 
          (Math.abs(currentSum - minSum) < 1e-12 && this.lexLess(knownValuesArray[i], minVal))) {
        minVal = knownValuesArray[i];
        minSum = currentSum;
      }
    }

    return this.cloneVector(minVal);
  },

  initKnownValuesSetsMulti(initialValues) {
    return initialValues.map(val => new Set([JSON.stringify(val)]));
  },
    

        
      
    distance(a, b, metric = 'euclidean') {
      if (metric === 'l1') return this.l1Distance(a, b);
      if (metric === 'linf') return this.lInfDistance(a, b);
      return this.euclideanDistance(a, b);
    },
    farthestPair(points, metric = 'euclidean') {
      if (!points || points.length < 2) return [null, null, 0];
      let bi = 0, bj = 1, bd = -1;
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const d = this.distance(points[i], points[j], metric);
          if (d > bd) { bd = d; bi = i; bj = j; }
        }
      }
      return [bi, bj, bd];
    },
    convexCombine(u, v, alpha) {
      const a = Math.min(1, Math.max(0, Number(alpha)));
      return u.map((ui, k) => (1 - a) * (ui || 0) + a * (v[k] || 0));
    },
    sumCoords(v) {
      return (Array.isArray(v) ? v : []).reduce((s, x) => s + (x || 0), 0);
    },
    lexLess(u, v) {
      for (let k = 0; k < Math.max(u.length, v.length); k++) {
        const a = u[k] || 0, b = v[k] || 0;
        if (a < b) return true;
        if (a > b) return false;
      }
      return false;
    },
    chooseMinExtreme(u, v) {
      const su = this.sumCoords(u), sv = this.sumCoords(v);
      if (su < sv) return this.cloneVector(u);
      if (sv < su) return this.cloneVector(v);
      return this.lexLess(u, v) ? this.cloneVector(u) : this.cloneVector(v);
    },


    // ===== ALGORITMOS MULTI-D =====

    /**
     * AMP (multi-D) — meetingPoint es **vector absoluto** en el espacio.
     * Si recibe un valor distinto, salta al meetingPoint (array).
     */
    multiAMP(currentValue, _receivedValue, meetingPoint) {
      const dim = Array.isArray(currentValue) ? currentValue.length : 0;
      if (dim === 0) return this.cloneVector(currentValue);

      // Normalizar meetingPoint a vector
      const mpVec = Array.isArray(meetingPoint)
        ? meetingPoint.slice(0, dim)
        : Array(dim).fill(typeof meetingPoint === 'number' ? meetingPoint : 0.5);

      return mpVec;
    },

    /**
     * FV (multi-D) — adopta el primer valor recibido que difiera del actual.
     */
    multiFV(currentValue, receivedDifferent) {
      return Array.isArray(receivedDifferent)
        ? this.cloneVector(receivedDifferent)
        : this.cloneVector(currentValue);
    },


    multiMIN(currentValue, receivedValues, distanceMetric = 'euclidean') {
      // Durante las rondas, MIN SIEMPRE mantiene el valor actual
      // Los valores recibidos se acumulan en el estado, no se procesan aquí
      return this.cloneVector(currentValue);
    },


    multiRecursiveAMP(currentValue, receivedValues, meetingPoint, distanceMetric = 'euclidean') {
      if (!receivedValues || receivedValues.length === 0) {
        return this.cloneVector(currentValue);
      }

      // ✅ Como 1D: const knownValues = [values[i], ...receivedMessages]
      const knownValues = [this.cloneVector(currentValue)];
      receivedValues.forEach(val => knownValues.push(this.cloneVector(val)));

      // ✅ Extraer α (meetingPoint como escalar)
      let alpha = Array.isArray(meetingPoint) ? Number(meetingPoint[0]) : meetingPoint;
      if (!Number.isFinite(alpha)) alpha = 0.5;
      alpha = Math.max(0, Math.min(1, alpha));

      const dim = currentValue.length;
      const minVec = Array(dim).fill(Infinity);
      const maxVec = Array(dim).fill(-Infinity);

      // ✅ Calcular min/max por coordenada
      knownValues.forEach(vec => {
        for (let d = 0; d < dim; d++) {
          const coord = vec[d] || 0;
          if (coord < minVec[d]) minVec[d] = coord;
          if (coord > maxVec[d]) maxVec[d] = coord;
        }
      });

      // ✅ Verificar rango como en 1D: const range = maxValue - minValue
      const rangeVec = Array(dim);
      let hasRange = false;
      for (let d = 0; d < dim; d++) {
        rangeVec[d] = maxVec[d] - minVec[d];
        if (Math.abs(rangeVec[d]) > 1e-12) {
          hasRange = true;
        }
      }

      if (!hasRange) {
        // ✅ Como 1D: if (range === 0) newValues[i] = values[i]
        return this.cloneVector(currentValue);
      }

      // ✅ FÓRMULA EXACTA del código 1D: newValues[i] = kmin + a * kr
      // Multi-D: newValue[d] = min[d] + α * range[d]
      const newValue = Array(dim);
      for (let d = 0; d < dim; d++) {
        newValue[d] = minVec[d] + alpha * rangeVec[d];
      }

      return newValue;
    },


    /**
     * Simula una ronda multi-D (con soporte de distanceMetric).
     */
    simulateMultiDimensionalRound(values, p, algorithm = "auto", meetingPoint = null, distanceMetric = 'euclidean') {
      const n = values.length;
      if (n === 0) {
        return { 
          newValues: [], 
          messages: [], 
          messageDelivery: [], 
          discrepancy: 0,
          algorithm,
          dimensions: 0,
          meetingPoint,
          knownValuesSets: null  // ⚠️ AÑADIR esta línea
        };
      }

      const dim = values[0].length;
      let algo = algorithm;
      if (algo === "auto") algo = p > 0.5 ? "AMP" : "FV";

      // ⚠️ NUEVO: Manejar knownValuesSets para MIN
      let knownValuesSets = null;
      if (algo === "MIN" && this.multiKnownValuesSets) {
        knownValuesSets = this.multiKnownValuesSets;
      }

      // Defaults coherentes para meetingPoint
      if (meetingPoint == null) {
        if (algo === "AMP") {
          meetingPoint = Array(dim).fill(0.5);
        } else if (algo === "RECURSIVE AMP") {
          meetingPoint = 0.5;
        } else {
          meetingPoint = Array(dim).fill(0.5);
        }
      }

      const newValues = this.cloneMatrix(values);
      const messages = [];
      const messageDelivery = [];

      // Envío de mensajes
      for (let sender = 0; sender < n; sender++) {
        const senderMessages = [];
        const deliveryRow = [];
        for (let receiver = 0; receiver < n; receiver++) {
          if (sender === receiver) continue;
          const delivered = Math.random() < p;
          senderMessages.push({ to: receiver, value: this.cloneVector(values[sender]), delivered });
          deliveryRow.push(delivered);
        }
        messages.push(senderMessages);
        messageDelivery.push(deliveryRow);
      }

      // Procesamiento y actualización
      for (let receiver = 0; receiver < n; receiver++) {
        const receivedMessages = [];
        for (let sender = 0; sender < n; sender++) {
          if (sender === receiver) continue;
          const msg = messages[sender].find(m => m.to === receiver);
          if (msg && msg.delivered) receivedMessages.push(msg.value);
        }
        if (receivedMessages.length === 0) continue;

        switch (algo) {
          case "AMP": {
            const differentValue = receivedMessages.find(v => this.areDifferent(values[receiver], v));
            if (differentValue) {
              newValues[receiver] = this.multiAMP(values[receiver], differentValue, meetingPoint);
            }
            break;
          }
          case "FV": {
            const differentValue = receivedMessages.find(v => this.areDifferent(values[receiver], v));
            if (differentValue) newValues[receiver] = this.cloneVector(differentValue);
            break;
          }
          case "MIN": {
            // MIN mantiene valor actual durante rondas
            newValues[receiver] = this.cloneVector(values[receiver]);
            
            // ⚠️ NUEVO: Acumular valores recibidos en knownValuesSets
            if (knownValuesSets && knownValuesSets[receiver]) {
              receivedMessages.forEach(val => {
                knownValuesSets[receiver].add(JSON.stringify(val));
              });
            }
            break;
          }
          case "CENTROID": {
            newValues[receiver] = this.multiCENTROID(values[receiver], receivedMessages);
            break;
          }
          case "RECURSIVE AMP": {
            newValues[receiver] = this.multiRecursiveAMP(values[receiver], receivedMessages, meetingPoint, distanceMetric);
            break;
          }
          default:
            console.warn(`Algoritmo no reconocido: ${algo}`);
            break;
        }
      }

      const discrepancy = this.calculateDiscrepancy(newValues, distanceMetric);

      // ⚠️ NUEVO: Retornar knownValuesSets convertido a arrays para compatibilidad
      let knownValuesSetsForReturn = null;
      if (algo === "MIN" && knownValuesSets) {
        knownValuesSetsForReturn = knownValuesSets.map(set => 
          Array.from(set).map(str => JSON.parse(str))
        );
      }

      return {
        newValues,
        messages,
        messageDelivery,
        discrepancy,
        algorithm: algo,
        dimensions: dim,
        meetingPoint,
        knownValuesSets: knownValuesSetsForReturn  
      };
    },


    // ===== EXPERIMENTOS MULTI-D =====
    runMultiDimensionalExperiment(initialValues, p, rounds, algorithm = "auto", meetingPoint = null, distanceMetric = 'euclidean') {
      const history = [];
      let currentValues = this.cloneMatrix(initialValues);
      
      // ⚠️ NUEVO: Inicializar estado para MIN (como en unidimensional)
      let multiKnownValuesSets = null;
      const resolvedAlgorithm = algorithm === "auto" ? (p > 0.5 ? "AMP" : "FV") : algorithm;
      
      if (resolvedAlgorithm === "MIN") {
        // Inicializar conjuntos con valor propio de cada proceso (como JSON strings)
        multiKnownValuesSets = initialValues.map(val => new Set([JSON.stringify(val)]));
        this.multiKnownValuesSets = multiKnownValuesSets; // Estado global para simulateRound
      }

      // ⚠️ NUEVO: Historia inicial con knownValuesSets
      const initialKnownValuesSets = resolvedAlgorithm === "MIN" 
        ? multiKnownValuesSets.map(set => Array.from(set).map(str => JSON.parse(str)))
        : null;

      history.push({
        round: 0,
        values: this.cloneMatrix(currentValues),
        discrepancy: this.calculateDiscrepancy(currentValues, distanceMetric),
        algorithm: resolvedAlgorithm,
        dimensions: currentValues[0]?.length || 0,
        meetingPoint,
        knownValuesSets: initialKnownValuesSets  
      });

      // Ejecutar rondas
      for (let round = 1; round <= rounds; round++) {
        const result = this.simulateMultiDimensionalRound(
          currentValues, p, algorithm, meetingPoint, distanceMetric
        );
        
        currentValues = result.newValues;
        
        
        if (resolvedAlgorithm === "MIN" && round === rounds) {
        
          for (let i = 0; i < currentValues.length; i++) {
            if (multiKnownValuesSets[i] && multiKnownValuesSets[i].size > 0) {
              const knownVectors = Array.from(multiKnownValuesSets[i]).map(str => JSON.parse(str));
              currentValues[i] = this.selectMinVectorFromSet(knownVectors);
            }
          }
          
       
          this.multiKnownValuesSets = null;
        }

        history.push({
          round,
          values: this.cloneMatrix(currentValues),
          discrepancy: this.calculateDiscrepancy(currentValues, distanceMetric),
          algorithm: resolvedAlgorithm,
          dimensions: currentValues[0]?.length || 0,
          meetingPoint,
          messages: result.messages || [],
          messageDelivery: result.messageDelivery || [],
          knownValuesSets: result.knownValuesSets  
        });
      }

      return history;
    },

    runMultipleMultiDimensionalExperiments(initialValues, p, rounds, repetitions, algorithm = "auto", meetingPoint = null, distanceMetric = 'euclidean') {
      const experiments = [];
      const roundStats = Array(rounds + 1).fill(0).map(() => []);

      for (let rep = 0; rep < repetitions; rep++) {
        const history = this.runMultiDimensionalExperiment(
          initialValues,
          p,
          rounds,
          algorithm,
          meetingPoint,
          distanceMetric
        );
        experiments.push(history);
        history.forEach((state, roundIdx) => {
          roundStats[roundIdx].push(state.discrepancy);
        });
      }

      const statistics = roundStats.map((discrepancies, round) => {
        if (discrepancies.length === 0) {
          return { round, mean: 0, min: 0, max: 0, stdDev: 0, samples: 0 };
        }
        const mean = discrepancies.reduce((a, b) => a + b, 0) / discrepancies.length;
        const min = Math.min(...discrepancies);
        const max = Math.max(...discrepancies);
        const variance = discrepancies.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / discrepancies.length;
        return { round, mean, min, max, stdDev: Math.sqrt(variance), samples: discrepancies.length };
      });

      return {
        experiments,
        statistics,
        finalDiscrepancy: statistics[rounds]
      };
    },
    

    selectMinVectorFromSet(vectorSet) {
      if (!vectorSet || vectorSet.length === 0) return null;
      if (vectorSet.length === 1) return this.cloneVector(vectorSet[0]);

      let minVector = vectorSet[0];
      let minSum = this.sumCoords(minVector);

      for (let i = 1; i < vectorSet.length; i++) {
        const currentSum = this.sumCoords(vectorSet[i]);
        
        if (currentSum < minSum) {
          minVector = vectorSet[i];
          minSum = currentSum;
        } else if (Math.abs(currentSum - minSum) < 1e-12) {
          // Desempate lexicográfico (menor en primera coord diferente)
          if (this.lexLess(vectorSet[i], minVector)) {
            minVector = vectorSet[i];
          }
        }
      }

      return this.cloneVector(minVector);
    },

    // ===== INICIALES MULTI-D =====
    generateInitialValues(processCount, dimensions, mode = 'corners', range = [0, 1]) {
      const [minVal, maxVal] = range;
      const values = [];
      switch (mode) {
        case 'corners':
          for (let i = 0; i < processCount; i++) {
            const val = [];
            for (let d = 0; d < dimensions; d++) {
              val.push(((i >> d) & 1) ? maxVal : minVal);
            }
            values.push(val);
          }
          break;
        case 'random':
          for (let i = 0; i < processCount; i++) {
            const val = [];
            for (let d = 0; d < dimensions; d++) {
              val.push(minVal + Math.random() * (maxVal - minVal));
            }
            values.push(val);
          }
          break;
        case 'center':
          const center = Array(dimensions).fill((minVal + maxVal) / 2);
          for (let i = 0; i < processCount; i++) values.push([...center]);
          break;
        case 'spread':
          for (let i = 0; i < processCount; i++) {
            const val = [];
            for (let d = 0; d < dimensions; d++) {
              const step = (maxVal - minVal) / (processCount - 1 || 1);
              val.push(minVal + (i % processCount) * step);
            }
            values.push(val);
          }
          break;
        case 'vertices':
          const numVertices = Math.pow(2, dimensions);
          const actualCount = Math.min(processCount, numVertices);
          for (let i = 0; i < actualCount; i++) {
            const val = [];
            for (let d = 0; d < dimensions; d++) {
              val.push(((i >> d) & 1) ? maxVal : minVal);
            }
            values.push(val);
          }
          for (let i = actualCount; i < processCount; i++) {
            const val = [];
            for (let d = 0; d < dimensions; d++) {
              val.push(minVal + Math.random() * (maxVal - minVal));
            }
            values.push(val);
          }
          break;
        default:
          throw new Error(`Unknown initialization mode: ${mode}`);
      }
      return values;
    },

    scalarToMultiDimensional(scalarValues, dimensions) {
      return scalarValues.map(v => {
        const vec = Array(dimensions).fill(0);
        vec[0] = v;
        return vec;
      });
    },
    multiDimensionalToScalar(multiValues) {
      return multiValues.map(vec => vec[0] || 0);
    }
  }, // fin multidimensional

// Alias para compatibilidad con código existente
barycentric: {
  generateInitialBarycentric(processCount, dimensions, mode) {
    // UI 'centroid' → motor 'center'
    const mapped = (mode === 'centroid') ? 'center' : mode;
    return SimulationEngine.multidimensional.generateInitialValues(processCount, dimensions, mapped);
  },
  normalizeBarycentric(coords) { return coords; },
  isValidBarycentric(coords) { return Array.isArray(coords); },


  calculateDiscrepancy(values, metric) {
    return SimulationEngine.multidimensional.calculateDiscrepancy(values, metric);
  },


  simulateBarycentricRound(values, p, algorithm, meetingPoint, distanceMetric = 'euclidean') {
    return SimulationEngine.multidimensional.simulateMultiDimensionalRound(
      values, p, algorithm, meetingPoint, distanceMetric
    );
  },

  runBarycentricExperiment(initialValues, p, rounds, algorithm = "auto", meetingPoint = null, distanceMetric = 'euclidean') {
    return SimulationEngine.multidimensional.runMultiDimensionalExperiment(
      initialValues, p, rounds, algorithm, meetingPoint, distanceMetric
    );
  },

  runMultipleBarycentricExperiments(initialValues, p, rounds, repetitions, algorithm = "auto", meetingPoint = null, distanceMetric = 'euclidean') {
    return SimulationEngine.multidimensional.runMultipleMultiDimensionalExperiments(
      initialValues, p, rounds, repetitions, algorithm, meetingPoint, distanceMetric
    );
  },

  randomBarycentric(dimensions) { return Array(dimensions).fill(0).map(() => Math.random()); },
  euclideanDistance(a, b) { return SimulationEngine.multidimensional.euclideanDistance(a, b); },
  l1Distance(a, b) { return SimulationEngine.multidimensional.l1Distance(a, b); },
  lInfDistance(a, b) { return SimulationEngine.multidimensional.lInfDistance(a, b); },
  areDifferent(a, b, eps) { return SimulationEngine.multidimensional.areDifferent(a, b, eps); }
},

// Alias para compatibilidad (también con distanceMetric)
runBarycentricExperiment(initialValues, p, rounds, algorithm = "auto", meetingPoint = null, distanceMetric = 'euclidean') {
  return this.multidimensional.runMultiDimensionalExperiment(
    initialValues, p, rounds, algorithm, meetingPoint, distanceMetric
  );
},
runMultipleBarycentricExperiments(initialValues, p, rounds, repetitions, algorithm = "auto", meetingPoint = null, distanceMetric = 'euclidean') {
  return this.multidimensional.runMultipleMultiDimensionalExperiments(
    initialValues, p, rounds, repetitions, algorithm, meetingPoint, distanceMetric
  );
},

  /**
   * Validación de las fórmulas de Teo. 4 (+ máximo en p=0.5).
   * Caso p=0.3 corregido: 0.09 / 0.51.
   */
  validateImplementation_T47: function() {
    console.log("=== VALIDACIÓN T47 (Teoremas 4 y 7) ===\n");

    const testCases = [
      { p: 0.5, expected1Round: 1/3 },
      { p: 0.3, expected1Round: 0.09/0.51 },
      { p: 0.7, expected1Round: 0.21/0.91 }
    ];

    let allPassed = true;
    testCases.forEach(test => {
      const calculated = this.calculateTheoreticalConditionedDiscrepancy(test.p, "auto", 1);
      const error = Math.abs(calculated - test.expected1Round);
      const passed = error < 1e-3;
      console.log(
        `p=${test.p}: Expected=${test.expected1Round.toFixed(6)}, ` +
        `Calculated=${calculated.toFixed(6)}, Error=${error.toExponential(2)} ${passed ? '✅' : '❌'}`
      );
      if (!passed) allPassed = false;
    });

    console.log("\n=== Verificación del máximo (≈1/3 en p≈0.5) ===");
    let maxValue = 0, maxP = 0;
    for (let p = 0.01; p <= 0.99; p += 0.01) {
      const value = this.calculateTheoreticalConditionedDiscrepancy(p, "auto", 1);
      if (value > maxValue) { maxValue = value; maxP = p; }
    }
    console.log(`Máximo encontrado: ${maxValue.toFixed(6)} en p=${maxP.toFixed(2)}`);
    console.log(`Máximo teórico: ${(1/3).toFixed(6)}`);
    console.log(`Diferencia: ${Math.abs(maxValue - 1/3).toFixed(8)}`);

    const maxPassed = Math.abs(maxValue - 1/3) < 1e-3;
    console.log(maxPassed ? '✅ Máximo correcto' : '❌ Máximo incorrecto');
    return allPassed && maxPassed;
  }

};
