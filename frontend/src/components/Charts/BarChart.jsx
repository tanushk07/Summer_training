import React from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

function BarChart({ labels, dataPoints, title, backgroundColors }) {
  // Default color if not provided
  const defaultColor = "rgba(75, 192, 192, 0.6)";
  const defaultBorderColor = "rgba(75, 192, 192, 1)";

  // If backgroundColors is a single color, use it for all bars
  // If it's an array, use different colors for each bar
  const backgroundColor = Array.isArray(backgroundColors)
    ? backgroundColors
    : new Array(labels.length).fill(backgroundColors || defaultColor);

  const borderColor = Array.isArray(backgroundColors)
    ? backgroundColors.map((color) => color.replace("0.6", "1"))
    : new Array(labels.length).fill(
        backgroundColors?.replace("0.6", "1") || defaultBorderColor
      );

  const data = {
    labels: labels,
    datasets: [
      {
        label: "Count",
        data: dataPoints,
        backgroundColor: backgroundColor,
        borderColor: borderColor,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Hide legend for cleaner look
      },
      title: {
        display: true,
        text: title,
        font: {
          size: 18,
          weight: "bold",
        },
        padding: {
          top: 10,
          bottom: 20,
        },
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const label = context.dataset.label || "";
            const value = context.parsed.y || 0;
            return `${label}: ${value}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          font: {
            size: 12,
          },
        },
        grid: {
          color: "rgba(0, 0, 0, 0.05)",
        },
      },
      x: {
        ticks: {
          font: {
            size: 12,
          },
          maxRotation: 45,
          minRotation: 0,
        },
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div style={{ width: "100%", height: "400px" }}>
      <Bar data={data} options={options} />
    </div>
  );
}

export default BarChart;
