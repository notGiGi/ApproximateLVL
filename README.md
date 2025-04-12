# ApproximateLVL Simulator

<div align="center">

**An Interactive Distributed Computing Agreement Simulator**

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org/)
[![Recharts](https://img.shields.io/badge/Recharts-2.x-purple.svg)](https://recharts.org/)

</div>

---

## 📚 About

ApproximateLVL is an advanced simulator for distributed computing agreement protocols. It provides an interactive visualization of how nodes in a distributed system converge to agreement despite unreliable message delivery.

The simulator explores the theoretical properties of two optimal algorithms - **Agreed Meeting Point (AMP)** and **Flip Value (FV)** - and demonstrates how their performance varies under different network reliability conditions.

## ✨ Key Features

- **🔄 Real-time Simulation**: Watch Alice and Bob nodes converge through iterative message exchanges
- **📊 Dynamic Visualization**: Interactive charts showing convergence behavior over time
- **⚙️ Configurable Parameters**: Adjust message delivery probability, initial values, algorithm selection, and more
- **📈 Statistical Analysis**: Run multiple experiments to validate theoretical predictions
- **📚 Range Experiments**: Test algorithm performance across a probability spectrum
- **💾 Experiment Storage**: Save, load, and compare different experiment configurations
- **🔍 Detailed Analysis**: Data tables, histograms, and comparative visualizations

## 🧠 Theoretical Background

### The Agreement Problem

In distributed systems, nodes must often reach consensus despite unreliable communication channels. ApproximateLVL simulates a simplified version of this problem with two nodes (Alice and Bob) exchanging values over a lossy network with message delivery probability **p**.

### Optimal Algorithms

The simulator implements two theoretically optimal algorithms:

#### 1. Agreed Meeting Point (AMP)
- **When to use**: Optimal when p > 0.5
- **Behavior**: When a node receives a message, it adopts a predetermined meeting point value
- **Expected discrepancy**: 1-p
- **Properties**: Performs better with reliable networks

#### 2. Flip Value (FV)
- **When to use**: Optimal when p ≤ 0.5
- **Behavior**: When a node receives a message, it directly adopts the sender's value
- **Expected discrepancy**: (1-p)² + p²
- **Properties**: More resilient to message loss in unreliable networks

<div align="center">

```
                     │
        AMP          │           FV
   Expected: 1-p     │    Expected: (1-p)² + p²
                     │
    More Efficient   │    More Efficient
        p > 0.5      │       p ≤ 0.5
                     │
                    0.5
```

</div>

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/notGiGi/ApproximateLVL.git

# Navigate to project directory
cd ApproximateLVL

# Install dependencies
npm install

# Start the development server
npm start
```

## 📖 How to Use

### Single Experiment

1. **Configure Parameters**:
   - Set initial values for Alice and Bob using the sliders
   - Adjust delivery probability (p)
   - Select algorithm (Auto, AMP, or FV)
   - Configure simulation rounds and repetitions

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
   - Save interesting configurations for later comparison

## 📊 Interface Overview

### Simulation Tab
- Real-time visualization of agreement convergence
- Round-by-round data table
- Animation controls for stepping through simulation

### Statistical Analysis Tab
- Distribution of final discrepancies
- Key metrics (mean, median, min, max, standard deviation)
- Comparison between experimental and theoretical results

### Theoretical Comparison Tab
- Experimental vs theoretical curves
- Configurable probability range testing
- Algorithm performance analysis

### Saved Experiments Tab
- Load and view previous experiments
- Compare multiple experiment configurations
- Filter and search experimental data

## 🔧 Technical Details

### Simulation Engine

The core simulation engine implements:

```javascript
// Core simulation round logic
simulateRound: (aliceValue, bobValue, p, algorithm, meetingPoint) => {
  // Determine actual algorithm based on probability
  if (algorithm === "auto") {
    algorithm = p > 0.5 ? "AMP" : "FV";
  }
  
  // Simulate message delivery with probability p
  const aliceMessageDelivered = Math.random() < p;
  const bobMessageDelivered = Math.random() < p;
  
  // Update values based on algorithm
  let newAliceValue = aliceValue;
  let newBobValue = bobValue;
  
  if (bobMessageDelivered) {
    newAliceValue = algorithm === "AMP" ? meetingPoint : bobValue;
  }
  
  if (aliceMessageDelivered) {
    newBobValue = algorithm === "AMP" ? meetingPoint : aliceValue;
  }
  
  return {
    newAliceValue,
    newBobValue,
    aliceReceived: bobMessageDelivered,
    bobReceived: aliceMessageDelivered
  };
}
```

### Recent Improvements

- **Fixed Range Experiment Implementation**: Now performs real simulations across probability ranges instead of approximating results
- **Enhanced Error Handling**: Robust validation of all data points prevents unexpected failures
- **Adaptive Simulation**: Automatically adjusts rounds based on proximity to critical probability thresholds
- **Performance Optimization**: Statistical validation through multiple repetitions
- **UI Resilience**: Graceful handling of incomplete or invalid data

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgements

- Based on theoretical work in distributed computing agreement protocols
- Inspired by academic research on approximate agreement in lossy networks
- Built with React and Recharts for visualization

---

<div align="center">
  <sub>Built with ❤️ by researchers and developers interested in distributed systems</sub>
</div>
