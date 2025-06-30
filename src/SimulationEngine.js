// SimulationEngine.js - Módulo de simulación para ApproximateLVL
// Usa decimal.js para manejo preciso de decimales

import Decimal from 'decimal.js';

// Configuración de decimal.js para mayor precisión
Decimal.set({
  precision: 50,        // 50 dígitos significativos
  rounding: 4,          // ROUND_HALF_UP
  toExpNeg: -30,        // Notación exponencial para números muy pequeños
  toExpPos: 30,         // Notación exponencial para números muy grandes
  maxE: 9e15,           // Exponente máximo
  minE: -9e15,          // Exponente mínimo
  modulo: 1,            // ROUND_DOWN para operaciones modulo
  crypto: false         // No usar crypto para números aleatorios
});

// Función auxiliar para convertir a Decimal de forma segura
function toDecimal(value) {
  if (value instanceof Decimal) return value;
  if (typeof value === 'number' || typeof value === 'string') {
    return new Decimal(value);
  }
  return new Decimal(0);
}

// Función auxiliar para generar números aleatorios usando Decimal
function randomDecimal() {
  return new Decimal(Math.random());
}

// Función auxiliar para potencias con Decimal
function pow(base, exponent) {
  return toDecimal(base).pow(toDecimal(exponent));
}

// Función auxiliar para valor absoluto
function abs(value) {
  return toDecimal(value).abs();
}

// Función auxiliar para máximo
function max(...values) {
  return values.reduce((max, current) => {
    const decCurrent = toDecimal(current);
    return decCurrent.gt(max) ? decCurrent : max;
  }, toDecimal(values[0] || 0));
}

// Función auxiliar para mínimo
function min(...values) {
  return values.reduce((min, current) => {
    const decCurrent = toDecimal(current);
    return decCurrent.lt(min) ? decCurrent : min;
  }, toDecimal(values[0] || Infinity));
}

// Motor de simulación
export const SimulationEngine = {
  // Simular una ronda de intercambio de mensajes
  simulateRound: function(values, p, algorithm = "auto", meetingPoint = 0.5, fvMethod = "average") {
    if (algorithm === "auto") {
      const decP = toDecimal(p);
      algorithm = decP.gt(0.5) ? "AMP" : "FV";
    }
    
    const processCount = values.length;
    const newValues = [...values];
    const messages = [];
    const messageDelivery = {};
    const decP = toDecimal(p);
    const decMeetingPoint = toDecimal(meetingPoint);
    
    // Generar matriz de entrega de mensajes
    for (let i = 0; i < processCount; i++) {
      for (let j = 0; j < processCount; j++) {
        if (i !== j) {
          const delivered = randomDecimal().lt(decP);
          const key = `from${i}to${j}`;
          messageDelivery[key] = delivered;
          messages.push({
            from: i,
            to: j,
            fromName: ["Alice", "Bob", "Charlie"][i],
            toName: ["Alice", "Bob", "Charlie"][j],
            delivered: delivered,
            value: values[i]
          });
        }
      }
    }
    
    // Procesar mensajes para cada proceso
    for (let i = 0; i < processCount; i++) {
      const receivedMessages = [];
      const receivedValues = new Set([values[i]]); // Incluir su propio valor
      
      // Recolectar mensajes recibidos
      for (let j = 0; j < processCount; j++) {
        if (i !== j && messageDelivery[`from${j}to${i}`]) {
          receivedMessages.push(values[j]);
          receivedValues.add(values[j]);
        }
      }
      
      // Aplicar algoritmo si se recibieron mensajes (se conocen múltiples valores)
      if (receivedValues.size > 1) {
        if (algorithm === "AMP") {
          // AMP: usar el punto de encuentro
          newValues[i] = decMeetingPoint.toNumber();
        } else { // Algoritmo FV
          // CORRECCIÓN: Implementación estándar de Flip - invierte el valor
          if (fvMethod === "flip" || processCount === 2) {
            newValues[i] = toDecimal(1).minus(toDecimal(values[i])).toNumber();
          } 
          // Si es 3+ procesos y se especificó otro método FV, aplicarlo
          else if (processCount >= 3) {
            switch(fvMethod) {
              case "average": {
                const sum = receivedMessages.reduce((acc, val) => acc.plus(toDecimal(val)), new Decimal(0));
                newValues[i] = sum.div(receivedMessages.length).toNumber();
                break;
              }
              case "median": {
                const allValues = [values[i], ...receivedMessages].sort((a, b) => toDecimal(a).minus(toDecimal(b)).toNumber());
                newValues[i] = allValues[Math.floor(allValues.length / 2)];
                break;
              }
              case "weighted": {
                const decOneMinusP = toDecimal(1).minus(decP);
                const pesoPropio = pow(decOneMinusP, receivedMessages.length);
                const pesoExterno = decP.div(receivedMessages.length);
                
                const weighted = toDecimal(values[i]).mul(pesoPropio).plus(
                  receivedMessages.reduce((sum, val) => sum.plus(toDecimal(val).mul(pesoExterno)), new Decimal(0))
                );
                newValues[i] = weighted.toNumber();
                break;
              }
              case "accelerated": {
                const medianValues = [values[i], ...receivedMessages].sort((a, b) => toDecimal(a).minus(toDecimal(b)).toNumber());
                const mediana = toDecimal(medianValues[Math.floor(medianValues.length / 2)]);
                const centroRango = new Decimal(0.5);
                const factorAceleracion = decP;
                
                const accelerated = mediana.plus(factorAceleracion.mul(centroRango.minus(mediana)));
                newValues[i] = accelerated.toNumber();
                break;
              }
              case "first":
                newValues[i] = receivedMessages[0];
                break;
              default:
                // Por defecto, usar el comportamiento real de FV (invertir valor)
                newValues[i] = toDecimal(1).minus(toDecimal(values[i])).toNumber();
            }
          }
        }
      }
    }
    
    // Calcular discrepancia máxima usando Decimal
    let maxDiscrepancy = new Decimal(0);
    for (let i = 0; i < processCount; i++) {
      for (let j = i+1; j < processCount; j++) {
        const discrepancy = abs(toDecimal(newValues[i]).minus(toDecimal(newValues[j])));
        if (discrepancy.gt(maxDiscrepancy)) {
          maxDiscrepancy = discrepancy;
        }
      }
    }
    
    return {
      newValues,
      messages,
      messageDelivery,
      discrepancy: maxDiscrepancy.toNumber()
    };
  },

  // Ejecutar un experimento completo
  runExperiment: function(initialValues, p, rounds, algorithm = "auto", meetingPoint = 0.5, fvMethod = "average") {
    let values = [...initialValues];
    const processCount = values.length;
    const processNames = ["Alice", "Bob", "Charlie"];
    
    // Calcular discrepancia inicial usando Decimal
    let initialDiscrepancy = new Decimal(0);
    for (let i = 0; i < processCount; i++) {
      for (let j = i+1; j < processCount; j++) {
        const discrepancy = abs(toDecimal(values[i]).minus(toDecimal(values[j])));
        if (discrepancy.gt(initialDiscrepancy)) {
          initialDiscrepancy = discrepancy;
        }
      }
    }
    
    // Historial de simulación
    const history = [{
      round: 0,
      values: [...values],
      processValues: values.reduce((obj, val, idx) => {
        obj[processNames[idx].toLowerCase()] = val;
        return obj;
      }, {}),
      discrepancy: initialDiscrepancy.toNumber(),
      messages: []
    }];
    
    // Ejecutar rondas
    for (let r = 1; r <= rounds; r++) {
      const result = SimulationEngine.simulateRound(values, p, algorithm, meetingPoint, fvMethod);
      values = result.newValues;
      
      // Registrar resultados para esta ronda
      history.push({
        round: r,
        values: [...values],
        processValues: values.reduce((obj, val, idx) => {
          obj[processNames[idx].toLowerCase()] = val;
          return obj;
        }, {}),
        discrepancy: result.discrepancy,
        messageDelivery: result.messageDelivery,
        messages: result.messages
      });
    }
    
    return history;
  },

  // Ejecutar múltiples experimentos para análisis estadístico
  runMultipleExperiments: function(initialValues, p, rounds, repetitions, algorithm = "auto", meetingPoint = 0.5, fvMethod = "average") {
    const allDiscrepancies = [];
    const allRuns = [];
    const processCount = initialValues.length;
    const decP = toDecimal(p);
    
    // Solo usar métodos FV para 3 procesos
    const useFVMethod = processCount === 3 ? fvMethod : "average";
    
    // Determinar algoritmo real si es auto
    const actualAlgorithm = algorithm === "auto" ? (decP.gt(0.5) ? "AMP" : "FV") : algorithm;
    
    // Ejecutar múltiples simulaciones
    for (let i = 0; i < repetitions; i++) {
      const history = SimulationEngine.runExperiment(
        initialValues, 
        p, 
        rounds, 
        algorithm, 
        meetingPoint, 
        useFVMethod
      );
      
      const finalDiscrepancy = history[history.length - 1].discrepancy;
      allDiscrepancies.push(finalDiscrepancy);
      allRuns.push(history);
    }
    
    // Calcular estadísticas usando Decimal
    const decDiscrepancies = allDiscrepancies.map(d => toDecimal(d));
    const mean = decDiscrepancies.reduce((sum, d) => sum.plus(d), new Decimal(0)).div(decDiscrepancies.length);
    
    const sorted = [...decDiscrepancies].sort((a, b) => a.minus(b).toNumber());
    const median = sorted.length % 2 === 0 ? 
      sorted[sorted.length / 2 - 1].plus(sorted[sorted.length / 2]).div(2) : 
      sorted[Math.floor(sorted.length / 2)];
    
    const minVal = min(...decDiscrepancies);
    const maxVal = max(...decDiscrepancies);
    
    const variance = decDiscrepancies.reduce((sum, d) => sum.plus(pow(d.minus(mean), 2)), new Decimal(0)).div(decDiscrepancies.length);
    const std = variance.sqrt();
    
    // Calcular discrepancia teórica para 2 procesos
    const theoretical = processCount === 2 ? 
      SimulationEngine.calculateExpectedDiscrepancy(p, algorithm, rounds) : 
      null;
    
    return {
      mean: mean.toNumber(),
      median: median.toNumber(),
      min: minVal.toNumber(),
      max: maxVal.toNumber(),
      std: std.toNumber(),
      allValues: allDiscrepancies,
      theoretical,
      algorithm: actualAlgorithm,
      processCount,
      allRuns
    };
  },

  // Calcular la discrepancia teórica esperada
  calculateExpectedDiscrepancy: function(p, algorithm = "auto", rounds = 1) {
    const decP = toDecimal(p);
    
    // Para compatibilidad con versiones anteriores, si rounds=1, usar cálculo original
    if (rounds === 1) {
      if (algorithm === "auto") {
        algorithm = decP.gt(0.5) ? "AMP" : "FV";
      }
      
      const q = toDecimal(1).minus(decP);
      const result = algorithm === "AMP" ? q : (pow(decP, 2).plus(pow(q, 2)));
      return result.toNumber();
    } 
    // Para múltiples rondas, usar la nueva función
    else {
      return this.calculateExpectedDiscrepancyMultiRound(p, rounds, algorithm);
    }
  },
  
  // Calcular discrepancia teórica esperada para múltiples rondas (2 procesos)
  calculateExpectedDiscrepancyMultiRound: function(p, rounds, algorithm = "auto") {
    const decP = toDecimal(p);
    
    if (algorithm === "auto") {
      algorithm = decP.gt(0.5) ? "AMP" : "FV";
    }
    
    const q = toDecimal(1).minus(decP);
    
    // Fórmulas del Teorema 3.2 en la teoría
    if (algorithm === "AMP") {
      // Para AMP: discrepancia esperada <= q^k
      return pow(q, rounds).toNumber();
    } else {
      // Para FV: discrepancia esperada <= (p² + q²)^k
      const pSquaredPlusQSquared = pow(decP, 2).plus(pow(q, 2));
      return pow(pSquaredPlusQSquared, rounds).toNumber();
    }
  },
  
  // Simular evolución de múltiples rondas con diferentes valores iniciales
  runMultiRoundAnalysis: function(initialGap, pValues, maxRounds, repetitions = 100) {
    const results = [];
    
    // Para cada valor p, analizar ambos algoritmos
    for (const p of pValues) {
      const decP = toDecimal(p);
      const q = toDecimal(1).minus(decP);
      const optimalAlgorithm = decP.gt(0.5) ? "AMP" : "FV";
      
      // Calcular discrepancias teóricas esperadas
      const theoreticalAMP = [];
      const theoreticalFV = [];
      
      for (let r = 0; r <= maxRounds; r++) {
        theoreticalAMP.push({
          round: r,
          discrepancy: pow(q, r).toNumber()
        });
        
        const pSquaredPlusQSquared = pow(decP, 2).plus(pow(q, 2));
        theoreticalFV.push({
          round: r,
          discrepancy: pow(pSquaredPlusQSquared, r).toNumber()
        });
      }
      
      // Ejecutar simulaciones experimentales
      const experimentalAMP = Array(maxRounds + 1).fill(0).map(() => ({ sumDiscrepancy: new Decimal(0), count: 0 }));
      const experimentalFV = Array(maxRounds + 1).fill(0).map(() => ({ sumDiscrepancy: new Decimal(0), count: 0 }));
      
      for (let i = 0; i < repetitions; i++) {
        // Simulación con AMP
        const historyAMP = this.runExperiment([0, initialGap], p, maxRounds, "AMP", 0.5);
        // Simulación con FV
        const historyFV = this.runExperiment([0, initialGap], p, maxRounds, "FV", 0.5);
        
        // Registrar resultados para cada ronda
        for (let r = 0; r <= maxRounds; r++) {
          experimentalAMP[r].sumDiscrepancy = experimentalAMP[r].sumDiscrepancy.plus(toDecimal(historyAMP[r].discrepancy));
          experimentalAMP[r].count++;
          
          experimentalFV[r].sumDiscrepancy = experimentalFV[r].sumDiscrepancy.plus(toDecimal(historyFV[r].discrepancy));
          experimentalFV[r].count++;
        }
      }
      
      // Calcular promedios experimentales
      const avgExperimentalAMP = experimentalAMP.map((data, idx) => ({
        round: idx,
        discrepancy: data.sumDiscrepancy.div(data.count).toNumber()
      }));
      
      const avgExperimentalFV = experimentalFV.map((data, idx) => ({
        round: idx,
        discrepancy: data.sumDiscrepancy.div(data.count).toNumber()
      }));
      
      // Agregar resultados
      results.push({
        probability: p,
        optimalAlgorithm,
        theoreticalAMP,
        theoreticalFV,
        experimentalAMP: avgExperimentalAMP,
        experimentalFV: avgExperimentalFV
      });
    }
    
    return results;
  },
  
  // Analizar tasa de convergencia por ronda
  analyzeConvergenceRate: function(p, rounds, algorithm = "auto") {
    const decP = toDecimal(p);
    
    if (algorithm === "auto") {
      algorithm = decP.gt(0.5) ? "AMP" : "FV";
    }
    
    const q = toDecimal(1).minus(decP);
    const rates = [];
    
    // Calcular tasa de reducción de discrepancia teórica por ronda
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
      
      // Tasa de convergencia (cuánto se reduce en esta ronda)
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

  // Calcular discrepancia esperada para n procesos
  calculateExpectedDiscrepancyNProcesses: function(p, n, m, algorithm = "auto", meetingPoint = 0.5) {
    const decP = toDecimal(p);
    const q = toDecimal(1).minus(decP);
    const decMeetingPoint = toDecimal(meetingPoint);
    
    // Determinar qué algoritmo usar si es auto
    if (algorithm === "auto") {
      algorithm = decP.gt(0.5) ? "AMP" : "FV";
    }
    
    if (algorithm === "AMP") {
      // Implementar fórmula para AMP con punto de encuentro a
      const a = decMeetingPoint;
      
      // Calcular probabilidades A y B según la teoría
      // A = Pr[cada jugador 0 recibió al menos un mensaje 1]
      const A = toDecimal(1).minus(pow(q, n-m));
      // B = Pr[cada jugador 1 recibió al menos un mensaje 0]
      const B = toDecimal(1).minus(pow(q, m));
      
      // Fórmula de discrepancia esperada para AMP(a)
      // E[Da(In.m)] = 1 - (aA + (1-a)B)
      return toDecimal(1).minus(a.mul(A).plus(toDecimal(1).minus(a).mul(B))).toNumber();
    } else {
      // Algoritmo FV (Flip)
      // Calcular probabilidades A, B y C según la teoría
      const A = toDecimal(1).minus(pow(q, n-m));
      const B = toDecimal(1).minus(pow(q, m));
      // C = Pr[ningún jugador 0 recibió mensaje 1]
      const C = pow(q, m*(n-m));
      
      // Fórmula de discrepancia esperada para Flip
      // E[DF(In.m)] = 1 - (CA + CB)
      return toDecimal(1).minus(C.mul(A).plus(C.mul(B))).toNumber();
    }
  },

  // Simular una ronda con n procesos
  simulateRoundWithNProcesses: function(values, p, algorithm = "auto", meetingPoint = 0.5) {
    const decP = toDecimal(p);
    
    if (algorithm === "auto") {
      algorithm = decP.gt(0.5) ? "AMP" : "FV";
    }
    
    const processCount = values.length;
    const newValues = [...values];
    const messages = [];
    const messageDelivery = {};
    const decMeetingPoint = toDecimal(meetingPoint);
    
    // Generar matriz de entrega de mensajes
    for (let i = 0; i < processCount; i++) {
      for (let j = 0; j < processCount; j++) {
        if (i !== j) {
          const delivered = randomDecimal().lt(decP);
          const key = `from${i}to${j}`;
          messageDelivery[key] = delivered;
          messages.push({
            from: i,
            to: j,
            fromName: i < 3 ? ["Alice", "Bob", "Charlie"][i] : `P${i+1}`,
            toName: j < 3 ? ["Alice", "Bob", "Charlie"][j] : `P${j+1}`,
            delivered: delivered,
            value: values[i]
          });
        }
      }
    }
    
    // Procesar mensajes para cada proceso
    for (let i = 0; i < processCount; i++) {
      const receivedMessages = [];
      const receivedValues = new Set([values[i]]); // Incluir su propio valor
      
      // Recolectar mensajes recibidos y valores únicos conocidos
      for (let j = 0; j < processCount; j++) {
        if (i !== j && messageDelivery[`from${j}to${i}`]) {
          receivedMessages.push(values[j]);
          receivedValues.add(values[j]);
        }
      }
      
      // Aplicar algoritmo si se conocen múltiples valores
      if (receivedValues.size > 1) {
        if (algorithm === "AMP") {
          // AMP: usar el punto de encuentro acordado
          newValues[i] = decMeetingPoint.toNumber();
        } else { // Algoritmo FV
          // FV: invertir su valor
          newValues[i] = toDecimal(1).minus(toDecimal(values[i])).toNumber();
        }
      }
    }
    
    // Calcular discrepancia máxima usando Decimal
    let maxDiscrepancy = new Decimal(0);
    for (let i = 0; i < processCount; i++) {
      for (let j = i+1; j < processCount; j++) {
        const discrepancy = abs(toDecimal(newValues[i]).minus(toDecimal(newValues[j])));
        if (discrepancy.gt(maxDiscrepancy)) {
          maxDiscrepancy = discrepancy;
        }
      }
    }
    
    return {
      newValues,
      messages,
      messageDelivery,
      discrepancy: maxDiscrepancy.toNumber()
    };
  },

  // Ejecutar experimento completo con n procesos
  runNProcessExperiment: function(initialValues, p, rounds, algorithm = "auto", meetingPoint = 0.5) {
    let values = [...initialValues];
    const processCount = values.length;
    const processNames = [];
    
    // Crear nombres para los procesos
    for (let i = 0; i < processCount; i++) {
      processNames.push(i < 3 ? ["Alice", "Bob", "Charlie"][i] : `Process${i+1}`);
    }
    
    // Calcular discrepancia inicial usando Decimal
    let initialDiscrepancy = new Decimal(0);
    for (let i = 0; i < processCount; i++) {
      for (let j = i+1; j < processCount; j++) {
        const discrepancy = abs(toDecimal(values[i]).minus(toDecimal(values[j])));
        if (discrepancy.gt(initialDiscrepancy)) {
          initialDiscrepancy = discrepancy;
        }
      }
    }
    
    // Historial de la simulación
    const history = [{
      round: 0,
      values: [...values],
      processValues: values.reduce((obj, val, idx) => {
        obj[processNames[idx].toLowerCase()] = val;
        return obj;
      }, {}),
      discrepancy: initialDiscrepancy.toNumber(),
      messages: []
    }];
    
    // Ejecutar rondas
    for (let r = 1; r <= rounds; r++) {
      const result = this.simulateRoundWithNProcesses(values, p, algorithm, meetingPoint);
      values = result.newValues;
      
      // Registrar resultados de esta ronda
      history.push({
        round: r,
        values: [...values],
        processValues: values.reduce((obj, val, idx) => {
          obj[processNames[idx].toLowerCase()] = val;
          return obj;
        }, {}),
        discrepancy: result.discrepancy,
        messageDelivery: result.messageDelivery,
        messages: result.messages
      });
    }
    
    return history;
  },

  // Ejecutar múltiples experimentos para análisis estadístico con n procesos
  runMultipleNProcessExperiments: function(initialValues, p, rounds, repetitions, algorithm = "auto", meetingPoint = 0.5) {
    const allDiscrepancies = [];
    const allRuns = [];
    const processCount = initialValues.length;
    
    // Contar número de procesos con valor 0 (para cálculos teóricos)
    let m = 0;
    initialValues.forEach(val => {
      if (val === 0) m++;
    });
    
    // Determinar algoritmo real si es auto
    const decP = toDecimal(p);
    const actualAlgorithm = algorithm === "auto" ? (decP.gt(0.5) ? "AMP" : "FV") : algorithm;
    
    // Ejecutar múltiples simulaciones
    for (let i = 0; i < repetitions; i++) {
      const history = this.runNProcessExperiment(
        initialValues, 
        p, 
        rounds, 
        algorithm, 
        meetingPoint
      );
      
      const finalDiscrepancy = history[history.length - 1].discrepancy;
      allDiscrepancies.push(finalDiscrepancy);
      allRuns.push(history);
    }
    
    // Calcular estadísticas usando Decimal
    const decDiscrepancies = allDiscrepancies.map(d => toDecimal(d));
    const mean = decDiscrepancies.reduce((sum, d) => sum.plus(d), new Decimal(0)).div(decDiscrepancies.length);
    
    const sorted = [...decDiscrepancies].sort((a, b) => a.minus(b).toNumber());
    const median = sorted.length % 2 === 0 ? 
      sorted[sorted.length / 2 - 1].plus(sorted[sorted.length / 2]).div(2) : 
      sorted[Math.floor(sorted.length / 2)];
    
    const minVal = min(...decDiscrepancies);
    const maxVal = max(...decDiscrepancies);
    
    const variance = decDiscrepancies.reduce((sum, d) => sum.plus(pow(d.minus(mean), 2)), new Decimal(0)).div(decDiscrepancies.length);
    const std = variance.sqrt();
    
    // Calcular discrepancia teórica para n procesos
    const theoretical = this.calculateExpectedDiscrepancyNProcesses(p, processCount, m, actualAlgorithm, meetingPoint);
    
    return {
      mean: mean.toNumber(),
      median: median.toNumber(),
      min: minVal.toNumber(),
      max: maxVal.toNumber(),
      std: std.toNumber(),
      allValues: allDiscrepancies,
      theoretical,
      algorithm: actualAlgorithm,
      processCount,
      allRuns,
      n: processCount,
      m: m  // Número de procesos con valor 0
    };
  }
};