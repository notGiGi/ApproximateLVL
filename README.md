# ApproximateLVL Simulator

<div align="center">

**An Interactive Distributed Computing Agreement Simulator**

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org/)
[![Recharts](https://img.shields.io/badge/Recharts-2.x-purple.svg)](https://recharts.org/)




</div>

<div align="center">
  <a href="https://notgigi.github.io/ApproximateLVL/" target="_blank">
    <img src="https://img.shields.io/badge/Online_Simulator-FF5722?style=for-the-badge" alt="Online Simulator">
  </a>
</div>


---

##  About

ApproximateLVL is a simulator for distributed computing agreement algorithms. It provides an interactive visualization of how nodes in a distributed system converge to agreement despite probabilistic channels.

The simulator explores the theoretical properties of two algorithms - **Agreed Meeting Point (AMP)** and **Flip Value (FV)** - and demonstrates how their performance varies under different probabilities.

##  Key Features

- **Real-time Simulation**: Watch Alice and Bob nodes converge through iterative message exchanges
- ** Dynamic Visualization**: Interactive charts showing convergence behavior over time
- ** Configurable Parameters**: Adjust message delivery probability, initial values, algorithm selection, and more
- ** Statistical Analysis**: Run multiple experiments to validate theoretical predictions
- ** Range Experiments**: Test algorithm performance across a probability range
- ** Experiment Storage**: Save, load, and compare different experiments
- ** Detailed Analysis**: Data tables, histograms, and comparative visualizations

##  Theoretical Background

### The Agreement Problem

In distributed systems, nodes must often reach consensus despite unreliable communication channels. ApproximateLVL simulates a simplified version of this problem with two nodes (Alice and Bob) exchanging values over a stochastic channel with message probability **p**.

### Optimal Algorithms

The simulator implements two theoretically optimal algorithms:

#### 1. Agreed Meeting Point (AMP)
- **When to use**: Optimal when p > 0.5
- **Behavior**: When a node receives a message, it adopts a predetermined meeting point value
- **Expected discrepancy**: 1-p

#### 2. Flip Value (FV)
- **When to use**: Optimal when p ≤ 0.5
- **Behavior**: When a node receives a message, it directly adopts the sender's value
- **Expected discrepancy**: (1-p)² + p²

##  How to Use

### Single Experiment

1. **Configure Parameters**:
   - Set initial values for Alice and Bob
   - Adjust delivery probability (p)
   - Select algorithm (Auto, AMP, or FV)
   - Configure simulation repetitions

2. **Run Simulation**:
   - Click "Start Simulation" to execute
   - Watch real-time convergence in the visualization panel

3. **Analyze Results**:
   - View round-by-round data in the table
   - Check final discrepancy values
   - Compare with theoretical predictions

### Range Experiments

1. **Navigate to the "Theoretical Comparison" tab**

2. **Configure Range**:
   - Set minimum and maximum probability values
   - Choose the number of steps
   - Select algorithm mode (Auto, Force AMP, Force FV)

3. **Run Range Experiment**:
   - Click "Run Range Experiments"
   - Monitor progress in real-time

4. **Analyze Results**:
   - Observe how experimental results match theoretical curves
   - Review detailed error metrics
   - Save interesting configurations of parameters for comparison

##  Interface Overview

### Simulation Tab
- Real-time visualization of algorithms
- Round-by-round data table

### Statistical Analysis Tab
- Distribution of final discrepancies
- Comparison between experimental and theoretical results

### Theoretical Comparison Tab
- Experimental vs theoretical curves
- Configurable probability range testing
- Algorithm performance analysis

### Saved Experiments Tab
- Load and view previous experiments
- Compare multiple experiment configurations


##  Acknowledgements

- Based on theoretical work in distributed computing agreement protocols by PIERRE FRAIGNIAUD, IRIF, University Paris Cité, CNRS, France; BOAZ PATT-SHAMIR, Tel Aviv University, Israel; SERGIO RAJSBAUM, IRIF and Instituto de Matemáticas, UNAM, Mexico.


---


