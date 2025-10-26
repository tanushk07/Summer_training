import React, { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

function LineChart({ labels, dataPoints, title }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Destroy previous chart
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext("2d");

    chartInstance.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels || [],
        datasets: [
          {
            label: title,
            data: dataPoints || [],
            borderColor: "rgb(75, 192, 192)",
            backgroundColor: "rgba(75, 192, 192, 0.2)",
            tension: 0.1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      },
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [labels, dataPoints, title]);

  return (
    <div style={{ position: "relative", height: "300px", width: "100%" }}>
      <canvas ref={chartRef}></canvas>
    </div>
  );
}

export default LineChart;
