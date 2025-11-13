"use client";

import { useRef, useEffect, useState } from "react";

type Point = { x: number; y: number };
type PathSegment = { type: "line" | "curve"; points: Point[] };

type EnergyData = {
  kineticEnergy: number;
  potentialEnergy: number;
  totalEnergy: number;
  energyLoss: number;
};

type PredictionData = {
  initialTotalEnergy: string;
  finalTotalEnergy: string;
  energyLoss: string;
  efficiency: string;
};

type PredictionResult = {
  metric: string;
  predicted: number;
  actual: number;
  isCorrect: boolean;
  accuracy: number;
};

type Bucket = {
  x: number;
  y: number;
  width: number;
  height: number;
  isHit: boolean;
};

export default function BallPathSimulator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [path, setPath] = useState<PathSegment[]>([]);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [drawMode, setDrawMode] = useState<"line" | "curve">("line");
  const [friction, setFriction] = useState(0.98);
  const [initialVelocity, setInitialVelocity] = useState(2);
  // New state for individual speed components
  const [horizontalSpeed, setHorizontalSpeed] = useState(2);
  const [verticalSpeed, setVerticalSpeed] = useState(0);
  const [speedControlMode, setSpeedControlMode] = useState<"combined" | "separate">("combined");
  
  // Bucket-related state
  const [bucket, setBucket] = useState<Bucket | null>(null);
  const [bucketPlacementMode, setBucketPlacementMode] = useState(false);
  const [showBucketResult, setShowBucketResult] = useState(false);
  const [bucketHit, setBucketHit] = useState(false);
  
  const [energyData, setEnergyData] = useState<EnergyData>({
    kineticEnergy: 0,
    potentialEnergy: 0,
    totalEnergy: 0,
    energyLoss: 0,
  });
  const [finalEnergyData, setFinalEnergyData] = useState<EnergyData | null>(
    null
  );
  const [predictions, setPredictions] = useState<PredictionData>({
    initialTotalEnergy: "",
    finalTotalEnergy: "",
    energyLoss: "",
    efficiency: "",
  });
  const [predictionResults, setPredictionResults] = useState<PredictionResult[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const animationRef = useRef<number>(0);
  const initialEnergyRef = useRef<number>(0);

  const BALL_RADIUS = 15;
  const BALL_MASS = 1; // kg
  const GRAVITY = 0.3;
  const GROUND_Y = 650;
  const TOLERANCE_PERCENTAGE = 10; // 10% tolerance for "correct" predictions
  
  // Bucket constants
  const BUCKET_WIDTH = 80;
  const BUCKET_HEIGHT = 60;

  // Sync combined velocity with individual components
  useEffect(() => {
    if (speedControlMode === "combined") {
      setHorizontalSpeed(initialVelocity);
      setVerticalSpeed(0);
    } else {
      // Update combined velocity based on individual components
      const combined = Math.sqrt(horizontalSpeed * horizontalSpeed + verticalSpeed * verticalSpeed);
      setInitialVelocity(combined);
    }
  }, [speedControlMode, initialVelocity, horizontalSpeed, verticalSpeed]);

  // Check if ball is inside bucket
  const checkBucketHit = (ballX: number, ballY: number): boolean => {
    if (!bucket) return false;
    
    const ballBottom = ballY + BALL_RADIUS;
    const bucketLeft = bucket.x - bucket.width / 2;
    const bucketRight = bucket.x + bucket.width / 2;
    const bucketTop = bucket.y - bucket.height;
    
    // Ball center must be within bucket horizontal bounds and ball bottom must be at or below bucket top
    return ballX >= bucketLeft && 
           ballX <= bucketRight && 
           ballBottom >= bucketTop && 
           ballBottom <= bucket.y;
  };

  // Calculate energy values
  const calculateEnergy = (
    velocityX: number,
    velocityY: number,
    ballY: number
  ): EnergyData => {
    const velocitySquared = velocityX * velocityX + velocityY * velocityY;
    const kineticEnergy = 0.5 * BALL_MASS * velocitySquared;

    const height = GROUND_Y - ballY;
    const potentialEnergy = BALL_MASS * GRAVITY * height;

    const totalEnergy = kineticEnergy + potentialEnergy;

    const energyLoss = initialEnergyRef.current - totalEnergy;

    return {
      kineticEnergy,
      potentialEnergy,
      totalEnergy,
      energyLoss,
    };
  };

  // Calculate prediction accuracy
  const calculatePredictionAccuracy = (predicted: number, actual: number): number => {
    if (actual === 0) return predicted === 0 ? 100 : 0;
    return Math.max(0, 100 - Math.abs((predicted - actual) / actual) * 100);
  };

  // Check if prediction is within tolerance
  const isPredictionCorrect = (predicted: number, actual: number): boolean => {
    if (actual === 0) return Math.abs(predicted) < 0.1;
    return Math.abs((predicted - actual) / actual) * 100 <= TOLERANCE_PERCENTAGE;
  };

  // Evaluate predictions after simulation
  const evaluatePredictions = (final: EnergyData) => {
    const results: PredictionResult[] = [];
    const initialEnergy = initialEnergyRef.current;
    const efficiency = ((initialEnergy - final.energyLoss) / initialEnergy) * 100;

    if (predictions.initialTotalEnergy) {
      const predicted = parseFloat(predictions.initialTotalEnergy);
      results.push({
        metric: "Initial Total Energy",
        predicted,
        actual: initialEnergy,
        isCorrect: isPredictionCorrect(predicted, initialEnergy),
        accuracy: calculatePredictionAccuracy(predicted, initialEnergy)
      });
    }

    if (predictions.finalTotalEnergy) {
      const predicted = parseFloat(predictions.finalTotalEnergy);
      results.push({
        metric: "Final Total Energy",
        predicted,
        actual: final.totalEnergy,
        isCorrect: isPredictionCorrect(predicted, final.totalEnergy),
        accuracy: calculatePredictionAccuracy(predicted, final.totalEnergy)
      });
    }

    if (predictions.energyLoss) {
      const predicted = parseFloat(predictions.energyLoss);
      results.push({
        metric: "Energy Loss",
        predicted,
        actual: final.energyLoss,
        isCorrect: isPredictionCorrect(predicted, final.energyLoss),
        accuracy: calculatePredictionAccuracy(predicted, final.energyLoss)
      });
    }

    if (predictions.efficiency) {
      const predicted = parseFloat(predictions.efficiency);
      results.push({
        metric: "Efficiency",
        predicted,
        actual: efficiency,
        isCorrect: isPredictionCorrect(predicted, efficiency),
        accuracy: calculatePredictionAccuracy(predicted, efficiency)
      });
    }

    setPredictionResults(results);
    
    // Show results modal if there are predictions
    if (results.length > 0) {
      setShowResultsModal(true);
    }
  };

  // Close results modal
  const closeResultsModal = () => {
    setShowResultsModal(false);
  };

  // Draw bucket
  const drawBucket = (ctx: CanvasRenderingContext2D, bucketData: Bucket) => {
    const bucketLeft = bucketData.x - bucketData.width / 2;
    const bucketRight = bucketData.x + bucketData.width / 2;
    const bucketTop = bucketData.y - bucketData.height;
    const bucketBottom = bucketData.y;

    // Bucket shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(bucketLeft + 3, bucketBottom + 3, bucketData.width, 8);

    // Bucket body (wood texture)
    const bucketGradient = ctx.createLinearGradient(bucketLeft, bucketTop, bucketRight, bucketBottom);
    bucketGradient.addColorStop(0, "#8B7355");
    bucketGradient.addColorStop(0.5, "#6B5847");
    bucketGradient.addColorStop(1, "#5A4A3A");
    
    ctx.fillStyle = bucketGradient;
    ctx.fillRect(bucketLeft, bucketTop, bucketData.width, bucketData.height);

    // Bucket rim
    ctx.fillStyle = "#4A3728";
    ctx.fillRect(bucketLeft - 5, bucketTop - 3, bucketData.width + 10, 6);

    // Bucket planks effect
    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const plankY = bucketTop + (bucketData.height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(bucketLeft, plankY);
      ctx.lineTo(bucketRight, plankY);
      ctx.stroke();
    }

    // Bucket handles
    ctx.strokeStyle = "#654321";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    
    // Left handle
    ctx.beginPath();
    ctx.arc(bucketLeft - 8, bucketTop + bucketData.height / 3, 8, -Math.PI / 3, Math.PI / 3);
    ctx.stroke();
    
    // Right handle
    ctx.beginPath();
    ctx.arc(bucketRight + 8, bucketTop + bucketData.height / 3, 8, (2 * Math.PI) / 3, (4 * Math.PI) / 3);
    ctx.stroke();

    // Hit indicator
    if (bucketData.isHit) {
      // Success glow
      ctx.shadowColor = "#10B981";
      ctx.shadowBlur = 20;
      ctx.strokeStyle = "#10B981";
      ctx.lineWidth = 4;
      ctx.strokeRect(bucketLeft - 2, bucketTop - 2, bucketData.width + 4, bucketData.height + 4);
      ctx.shadowBlur = 0;
      
      // Success text
      ctx.fillStyle = "#10B981";
      ctx.font = "bold 16px Arial";
      ctx.textAlign = "center";
      ctx.fillText("SUCCESS! 🎯", bucketData.x, bucketTop - 20);
    }
  };

  // Draw mountain background
  const drawBackground = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement
  ) => {
    // Sky gradient
    const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGradient.addColorStop(0, "#87CEEB");
    skyGradient.addColorStop(0.7, "#B0E0E6");
    skyGradient.addColorStop(1, "#E0F6FF");
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw mountains in the background
    ctx.fillStyle = "#8B7D6B";
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    ctx.lineTo(0, canvas.height - 150);
    ctx.lineTo(150, canvas.height - 200);
    ctx.lineTo(250, canvas.height - 150);
    ctx.lineTo(300, canvas.height - 180);
    ctx.lineTo(canvas.width, canvas.height - 100);
    ctx.lineTo(canvas.width, canvas.height);
    ctx.closePath();
    ctx.fill();

    // Mountain snow caps
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.moveTo(150, canvas.height - 200);
    ctx.lineTo(130, canvas.height - 180);
    ctx.lineTo(170, canvas.height - 180);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(300, canvas.height - 180);
    ctx.lineTo(280, canvas.height - 160);
    ctx.lineTo(320, canvas.height - 160);
    ctx.closePath();
    ctx.fill();

    // Ground
    ctx.fillStyle = "#C4A574";
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);

    // Ground shadow/texture
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
    ctx.fillRect(0, GROUND_Y, canvas.width, 5);
  };

  // Draw everything on canvas
  const drawCanvas = (
    ctx: CanvasRenderingContext2D,
    ballPosition?: Point
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    drawBackground(ctx, canvas);

    // Draw bucket if placed
    if (bucket) {
      drawBucket(ctx, bucket);
    }

    // Draw existing path segments
    path.forEach((segment) => {
      // Path shadow
      ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (segment.type === "line" && segment.points.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(segment.points[0].x + 2, segment.points[0].y + 3);
        for (let i = 1; i < segment.points.length; i++) {
          ctx.lineTo(segment.points[i].x + 2, segment.points[i].y + 3);
        }
        ctx.stroke();
      } else if (segment.type === "curve" && segment.points.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(segment.points[0].x + 2, segment.points[0].y + 3);
        for (let i = 1; i < segment.points.length; i++) {
          const xc = (segment.points[i - 1].x + segment.points[i].x) / 2;
          const yc = (segment.points[i - 1].y + segment.points[i].y) / 2;
          ctx.quadraticCurveTo(
            segment.points[i - 1].x + 2,
            segment.points[i - 1].y + 3,
            xc + 2,
            yc + 3
          );
        }
        const last = segment.points[segment.points.length - 1];
        ctx.lineTo(last.x + 2, last.y + 3);
        ctx.stroke();
      }

      // Main path (wood texture)
      const pathGradient = ctx.createLinearGradient(0, 0, 0, 20);
      pathGradient.addColorStop(0, "#8B7355");
      pathGradient.addColorStop(0.5, "#6B5847");
      pathGradient.addColorStop(1, "#5A4A3A");
      ctx.strokeStyle = pathGradient;
      ctx.lineWidth = 6;

      if (segment.type === "line" && segment.points.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(segment.points[0].x, segment.points[0].y);
        for (let i = 1; i < segment.points.length; i++) {
          ctx.lineTo(segment.points[i].x, segment.points[i].y);
        }
        ctx.stroke();

        // Wood planks effect
        ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
        ctx.lineWidth = 1;
        for (let i = 0; i < segment.points.length - 1; i++) {
          const segments = 10;
          for (let j = 0; j < segments; j++) {
            const t = j / segments;
            const x =
              segment.points[i].x +
              (segment.points[i + 1].x - segment.points[i].x) * t;
            const y =
              segment.points[i].y +
              (segment.points[i + 1].y - segment.points[i].y) * t;
            const dx = segment.points[i + 1].x - segment.points[i].x;
            const dy = segment.points[i + 1].y - segment.points[i].y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0) {
              const nx = (-dy / len) * 3;
              const ny = (dx / len) * 3;

              ctx.beginPath();
              ctx.moveTo(x + nx, y + ny);
              ctx.lineTo(x - nx, y - ny);
              ctx.stroke();
            }
          }
        }
      } else if (segment.type === "curve" && segment.points.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(segment.points[0].x, segment.points[0].y);
        for (let i = 1; i < segment.points.length; i++) {
          const xc = (segment.points[i - 1].x + segment.points[i].x) / 2;
          const yc = (segment.points[i - 1].y + segment.points[i].y) / 2;
          ctx.quadraticCurveTo(
            segment.points[i - 1].x,
            segment.points[i - 1].y,
            xc,
            yc
          );
        }
        const last = segment.points[segment.points.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.stroke();
      }

      // Draw control points
      segment.points.forEach((point, idx) => {
        ctx.fillStyle = idx === 0 ? "#10b981" : "#6366f1";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    });

    // Draw current path being drawn
    if (currentPoints.length > 0) {
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
      for (let i = 1; i < currentPoints.length; i++) {
        ctx.lineTo(currentPoints[i].x, currentPoints[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      currentPoints.forEach((point) => {
        ctx.fillStyle = "#fbbf24";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }

    // Draw ball with shadow
    if (
      ballPosition &&
      isFinite(ballPosition.x) &&
      isFinite(ballPosition.y)
    ) {
      // Shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
      ctx.beginPath();
      ctx.ellipse(
        ballPosition.x,
        ballPosition.y + BALL_RADIUS + 3,
        BALL_RADIUS * 0.9,
        BALL_RADIUS * 0.3,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Ball gradient
      const gradient = ctx.createRadialGradient(
        ballPosition.x - 5,
        ballPosition.y - 5,
        2,
        ballPosition.x,
        ballPosition.y,
        BALL_RADIUS
      );
      gradient.addColorStop(0, "#ff6b6b");
      gradient.addColorStop(0.4, "#ee5a52");
      gradient.addColorStop(0.7, "#dc2626");
      gradient.addColorStop(1, "#991b1b");

      ctx.fillStyle = gradient;
      ctx.shadowColor = "rgba(220, 38, 38, 0.5)";
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(ballPosition.x, ballPosition.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Ball highlights
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.beginPath();
      ctx.arc(
        ballPosition.x - 5,
        ballPosition.y - 5,
        BALL_RADIUS * 0.25,
        0,
        Math.PI * 2
      );
      ctx.fill();

      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.beginPath();
      ctx.arc(
        ballPosition.x - 3,
        ballPosition.y - 7,
        BALL_RADIUS * 0.15,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Draw bucket placement guide if in bucket placement mode
    if (bucketPlacementMode) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.font = "16px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Click on the ground to place bucket", canvas.width / 2, 50);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isAnimating) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Handle bucket placement
    if (bucketPlacementMode) {
      // Only place bucket on or near the ground
      if (y >= GROUND_Y - 20) {
        setBucket({
          x: x,
          y: GROUND_Y,
          width: BUCKET_WIDTH,
          height: BUCKET_HEIGHT,
          isHit: false
        });
        setBucketPlacementMode(false);
        
        // Redraw canvas to show bucket
        const ctx = canvas.getContext("2d");
        if (ctx) drawCanvas(ctx);
      }
      return;
    }

    // Handle path point placement
    setCurrentPoints([...currentPoints, { x, y }]);
  };

  const completeSegment = () => {
    if (currentPoints.length >= 2) {
      setPath([...path, { type: drawMode, points: [...currentPoints] }]);
      setCurrentPoints([]);
    }
  };

  const clearAll = () => {
    setPath([]);
    setCurrentPoints([]);
    setBucket(null);
    setBucketPlacementMode(false);
    setShowBucketResult(false);
    setBucketHit(false);
    setIsAnimating(false);
    setFinalEnergyData(null);
    setPredictions({
      initialTotalEnergy: "",
      finalTotalEnergy: "",
      energyLoss: "",
      efficiency: "",
    });
    setPredictionResults([]);
    setShowPredictions(false);
    setShowResultsModal(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  const stopSimulation = () => {
    setIsAnimating(false);
    if (finalEnergyData) {
      evaluatePredictions(finalEnergyData);
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  const handlePredictionChange = (field: keyof PredictionData, value: string) => {
    setPredictions(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const placeBucket = () => {
    setBucketPlacementMode(true);
    setShowBucketResult(false);
    setBucketHit(false);
    if (bucket) {
      setBucket(prev => prev ? { ...prev, isHit: false } : null);
    }
  };

  const removeBucket = () => {
    setBucket(null);
    setBucketPlacementMode(false);
    setShowBucketResult(false);
    setBucketHit(false);
  };

  // Get interpolated path points
  const getPathPoints = (): Point[] => {
    const points: Point[] = [];

    path.forEach((segment) => {
      if (segment.type === "line") {
        for (let i = 0; i < segment.points.length - 1; i++) {
          const p1 = segment.points[i];
          const p2 = segment.points[i + 1];
          const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          const steps = Math.max(Math.floor(distance / 5), 1);

          for (let t = 0; t <= steps; t++) {
            const ratio = t / steps;
            points.push({
              x: p1.x + (p2.x - p1.x) * ratio,
              y: p1.y + (p2.y - p1.y) * ratio,
            });
          }
        }
      } else if (segment.type === "curve") {
        for (let i = 0; i < segment.points.length - 1; i++) {
          const p1 = segment.points[i];
          const p2 = segment.points[i + 1];
          const steps = 30;

          for (let t = 0; t <= steps; t++) {
            const ratio = t / steps;
            points.push({
              x: p1.x + (p2.x - p1.x) * ratio,
              y: p1.y + (p2.y - p1.y) * ratio,
            });
          }
        }
      }
    });

    return points;
  };

  // Check collision with path
  const getCollisionPoint = (
    ballPos: Point,
    pathPoints: Point[]
  ): Point | null => {
    for (let i = 0; i < pathPoints.length - 1; i++) {
      const p1 = pathPoints[i];
      const p2 = pathPoints[i + 1];

      const A = ballPos.x - p1.x;
      const B = ballPos.y - p1.y;
      const C = p2.x - p1.x;
      const D = p2.y - p1.y;

      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      let param = -1;

      if (lenSq !== 0) param = dot / lenSq;

      let xx, yy;

      if (param < 0) {
        xx = p1.x;
        yy = p1.y;
      } else if (param > 1) {
        xx = p2.x;
        yy = p2.y;
      } else {
        xx = p1.x + param * C;
        yy = p1.y + param * D;
      }

      const dx = ballPos.x - xx;
      const dy = ballPos.y - yy;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < BALL_RADIUS + 3) {
        return { x: xx, y: yy };
      }
    }
    return null;
  };

  // Run physics simulation
  const runSimulation = () => {
    if (path.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsAnimating(true);
    setFinalEnergyData(null);
    setPredictionResults([]);
    setShowResultsModal(false);
    setShowBucketResult(false);
    setBucketHit(false);
    
    // Reset bucket hit state
    if (bucket) {
      setBucket(prev => prev ? { ...prev, isHit: false } : null);
    }
    
    const pathPoints = getPathPoints();

    let ballX = pathPoints[0]?.x || canvas.width / 2;
    let ballY = 50;
    
    // Use individual speed components if in separate mode
    let velocityX = speedControlMode === "separate" ? horizontalSpeed : initialVelocity;
    let velocityY = speedControlMode === "separate" ? verticalSpeed : 0;
    
    let onGround = false;
    let ballInBucket = false;

    // Set initial energy
    const initialEnergy = calculateEnergy(velocityX, velocityY, ballY);
    initialEnergyRef.current = initialEnergy.totalEnergy;

    const animate = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx || !canvas) return;

      velocityY += GRAVITY;

      ballX += velocityX;
      ballY += velocityY;

      // Validate ball position
      if (!isFinite(ballX) || !isFinite(ballY)) {
        setIsAnimating(false);
        const final = energyData;
        setFinalEnergyData(final);
        evaluatePredictions(final);
        return;
      }

      // Check if ball is in bucket
      if (bucket && !ballInBucket) {
        ballInBucket = checkBucketHit(ballX, ballY);
        if (ballInBucket) {
          setBucketHit(true);
          setBucket(prev => prev ? { ...prev, isHit: true } : null);
          setShowBucketResult(true);
          
          // Ball stops when it hits the bucket
          const bucketTop = bucket.y - bucket.height;
          ballY = bucketTop - BALL_RADIUS;
          velocityX = 0;
          velocityY = 0;
          onGround = true;
        }
      }

      // Check collision with ground (only if not in bucket)
      if (!ballInBucket && ballY + BALL_RADIUS >= GROUND_Y) {
        ballY = GROUND_Y - BALL_RADIUS;
        velocityY = 0;
        onGround = true;
        velocityX *= friction;
        
        // Show bucket result even if missed
        if (bucket) {
          setShowBucketResult(true);
        }
      }

      // Check collision with path (only if not in bucket)
      if (!ballInBucket) {
        const collision = getCollisionPoint({ x: ballX, y: ballY }, pathPoints);

        if (collision) {
          const targetY = collision.y - BALL_RADIUS;

          if (ballY > targetY) {
            ballY = targetY;
            velocityY = 0;
            onGround = true;
          }

          let nearestIdx = 0;
          let minDist = Infinity;

          for (let i = 0; i < pathPoints.length; i++) {
            const dist = Math.hypot(
              pathPoints[i].x - ballX,
              pathPoints[i].y - ballY
            );
            if (dist < minDist) {
              minDist = dist;
              nearestIdx = i;
            }
          }

          if (nearestIdx < pathPoints.length - 1 && onGround) {
            const next = pathPoints[nearestIdx + 1];
            const current = pathPoints[nearestIdx];
            const dx = next.x - current.x;
            if (dx !== 0) {
              const slope = (next.y - current.y) / dx;
              velocityX += slope * 1;
            }
          }
        } else {
          onGround = false;
        }
      }

      if (!ballInBucket) {
        velocityX *= friction;
      }

      // Check if ball has stopped moving
      if (Math.abs(velocityX) < 0.1 && Math.abs(velocityY) < 0.1) {
        velocityX = 0;
        velocityY = 0;
        const finalEnergy = calculateEnergy(velocityX, velocityY, ballY);
        setEnergyData(finalEnergy);
        setFinalEnergyData(finalEnergy);
        evaluatePredictions(finalEnergy);
        drawCanvas(ctx, { x: ballX, y: ballY });
        setIsAnimating(false);
        return;
      }

      // Update energy data
      const currentEnergy = calculateEnergy(velocityX, velocityY, ballY);
      setEnergyData(currentEnergy);

      drawCanvas(ctx, { x: ballX, y: ballY });
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawCanvas(ctx);
  }, [path, currentPoints, bucket, bucketPlacementMode]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-500 to-blue-300 flex flex-col">
      {/* Bucket Result Modal */}
      {showBucketResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in duration-300">
            <div className={`p-6 rounded-t-xl ${bucketHit ? 'bg-gradient-to-r from-green-400 to-green-500' : 'bg-gradient-to-r from-red-400 to-red-500'} text-white text-center`}>
              <div className="text-4xl mb-2">
                {bucketHit ? '🎯' : '😅'}
              </div>
              <h2 className="text-2xl font-bold">
                {bucketHit ? 'Direct Hit!' : 'Missed the Bucket!'}
              </h2>
              <p className="mt-2 text-lg">
                {bucketHit 
                  ? 'Perfect aim! The ball landed right in the bucket!' 
                  : 'Better luck next time! Try adjusting your path or speed.'
                }
              </p>
            </div>
            <div className="p-6">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBucketResult(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowBucketResult(false);
                    clearAll();
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prediction Results Modal */}
      {showResultsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-300">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white p-6 rounded-t-xl">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    🏆 Prediction Results
                  </h2>
                </div>
                <button
                  onClick={closeResultsModal}
                  className="text-white hover:text-yellow-200 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* Overall Score */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl font-bold mb-3">
                  {predictionResults.filter(r => r.isCorrect).length}/{predictionResults.length}
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-1">
                  Overall Score
                </h3>
                <p className="text-gray-600">
                  {predictionResults.filter(r => r.isCorrect).length === predictionResults.length 
                    ? '🎉 Perfect predictions! You\'re a physics master!' 
                    : predictionResults.filter(r => r.isCorrect).length === 0
                    ? '📚 Keep learning!'
                    : `${((predictionResults.filter(r => r.isCorrect).length / predictionResults.length) * 100).toFixed(0)}% correct - Great effort!`
                  }
                </p>
              </div>

              {/* Individual Results */}
              <div className="space-y-4">
                {predictionResults.map((result, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-semibold text-gray-800 text-lg">{result.metric}</h4>
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                        result.isCorrect 
                          ? 'bg-green-100 text-green-800 border border-green-200' 
                          : 'bg-red-100 text-red-800 border border-red-200'
                      }`}>
                        {result.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                        <p className="text-sm text-purple-600 font-medium mb-1">Your Prediction</p>
                        <p className="text-xl font-bold text-purple-800">
                          {result.predicted.toFixed(2)}
                          {result.metric.includes('%') ? '%' : ' J'}
                        </p>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-600 font-medium mb-1">Actual Result</p>
                        <p className="text-xl font-bold text-blue-800">
                          {result.actual.toFixed(2)}
                          {result.metric.includes('%') ? '%' : ' J'}
                        </p>
                      </div>
                    </div>

                    {/* Accuracy Bar */}
                    <div className="bg-gray-100 rounded-full h-3 mb-2">
                      <div 
                        className={`h-3 rounded-full transition-all duration-500 ${
                          result.accuracy >= 90 ? 'bg-green-500' :
                          result.accuracy >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.max(result.accuracy, 5)}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-600 text-right">
                      Accuracy: <span className="font-bold">{result.accuracy.toFixed(1)}%</span>
                    </p>
                  </div>
                ))}
              </div>

              {/* Educational Note */}
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                  💡Note
                </h4>
                <p className="text-blue-700 text-sm">
                  Predictions within ±{TOLERANCE_PERCENTAGE}% are considered correct. 
                 </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={closeResultsModal}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    closeResultsModal();
                    clearAll();
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-blue-600 text-white py-4 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold">Path Simulator with Target Challenge</h1>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white/95 backdrop-blur border-b border-gray-200 shadow">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex flex-wrap gap-2 items-center justify-center mb-3">
            <button
              onClick={() => setDrawMode("line")}
              disabled={isAnimating}
              className={`px-4 py-2 rounded-lg font-medium transition shadow-sm ${
                drawMode === "line"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Line Mode
            </button>
            <button
              onClick={() => setDrawMode("curve")}
              disabled={isAnimating}
              className={`px-4 py-2 rounded-lg font-medium transition shadow-sm ${
                drawMode === "curve"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Curve Mode
            </button>
            <button
              onClick={completeSegment}
              disabled={currentPoints.length < 2 || isAnimating}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ✓ Complete Segment
            </button>
            <button
              onClick={placeBucket}
              disabled={isAnimating || bucketPlacementMode}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🪣 {bucket ? 'Move' : 'Place'} Bucket
            </button>
            {bucket && (
              <button
                onClick={removeBucket}
                disabled={isAnimating}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ❌ Remove Bucket
              </button>
            )}
            <button
              onClick={() => setShowPredictions(!showPredictions)}
              disabled={isAnimating || path.length === 0}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🎯 Make Predictions
            </button>
            <button
              onClick={runSimulation}
              disabled={path.length === 0 || isAnimating}
              className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ▶ Run Simulation
            </button>
            <button
              onClick={stopSimulation}
              disabled={!isAnimating}
              className="px-5 py-2  bg-red-600  hover:bg-red-700 text-white rounded-lg font-bold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ⏹ Stop
            </button>
            <button
              onClick={clearAll}
              disabled={isAnimating}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg font-medium transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear All
            </button>
          </div>

          {/* Speed Control Mode Toggle */}
          <div className="flex items-center justify-center gap-4 mb-3 pt-2 border-t border-gray-200">
            <span className="font-medium text-gray-700">Speed Control:</span>
            <button
              onClick={() => setSpeedControlMode("combined")}
              disabled={isAnimating}
              className={`px-4 py-2 rounded-lg font-medium transition shadow-sm ${
                speedControlMode === "combined"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Combined
            </button>
            <button
              onClick={() => setSpeedControlMode("separate")}
              disabled={isAnimating}
              className={`px-4 py-2 rounded-lg font-medium transition shadow-sm ${
                speedControlMode === "separate"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Separate H/V
            </button>
          </div>

          {/* Sliders */}
          <div className="space-y-3">
            {speedControlMode === "combined" ? (
              // Combined Initial Velocity Slider
              <div className="flex items-center justify-center gap-4">
                <label className="font-medium text-gray-700 flex items-center gap-2">
                  <span>🚀 Initial Velocity:</span>
                  <span className="text-red-600 font-bold min-w-[3rem] text-right">
                    {initialVelocity.toFixed(1)}
                  </span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  value={initialVelocity}
                  onChange={(e) => setInitialVelocity(parseFloat(e.target.value))}
                  disabled={isAnimating}
                  className="w-64 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="text-xs text-gray-500 flex gap-4">
                  <span>Slow (0)</span>
                  <span>Fast (10)</span>
                </div>
              </div>
            ) : (
              // Separate Horizontal and Vertical Speed Sliders
              <>
                <div className="flex items-center justify-center gap-4">
                  <label className="font-medium text-gray-700 flex items-center gap-2">
                    <span>➡️ Horizontal Speed:</span>
                    <span className="text-green-600 font-bold min-w-[3rem] text-right">
                      {horizontalSpeed.toFixed(1)}
                    </span>
                  </label>
                  <input
                    type="range"
                    min="-10"
                    max="10"
                    step="0.1"
                    value={horizontalSpeed}
                    onChange={(e) => setHorizontalSpeed(parseFloat(e.target.value))}
                    disabled={isAnimating}
                    className="w-64 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="text-xs text-gray-500 flex gap-4">
                    <span>Left (-10)</span>
                    <span>Right (10)</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-4">
                  <label className="font-medium text-gray-700 flex items-center gap-2">
                    <span>⬇️ Vertical Speed:</span>
                    <span className="text-purple-600 font-bold min-w-[3rem] text-right">
                      {verticalSpeed.toFixed(1)}
                    </span>
                  </label>
                  <input
                    type="range"
                    min="-10"
                    max="10"
                    step="0.1"
                    value={verticalSpeed}
                    onChange={(e) => setVerticalSpeed(parseFloat(e.target.value))}
                    disabled={isAnimating}
                    className="w-64 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="text-xs text-gray-500 flex gap-4">
                    <span>Up (-10)</span>
                    <span>Down (10)</span>
                  </div>
                </div>
                
                {/* Combined velocity display */}
                <div className="flex items-center justify-center text-sm text-gray-600">
                  <span>Combined velocity magnitude: </span>
                  <span className="font-bold text-indigo-600 ml-1">
                    {Math.sqrt(horizontalSpeed * horizontalSpeed + verticalSpeed * verticalSpeed).toFixed(1)}
                  </span>
                </div>
              </>
            )}

            {/* Friction Slider */}
            <div className="flex items-center justify-center gap-4">
              <label className="font-medium text-gray-700 flex items-center gap-2">
                <span>🎚️ Friction:</span>
                <span className="text-blue-600 font-bold min-w-[3rem] text-right">
                  {friction.toFixed(2)}
                </span>
              </label>
              <input
                type="range"
                min="0.10"
                max="0.99"
                step="0.01"
                value={friction}
                onChange={(e) => setFriction(parseFloat(e.target.value))}
                disabled={isAnimating}
                className="w-64 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="text-xs text-gray-500 flex gap-4">
                <span>Low (0.10)</span>
                <span>High (0.99)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - Canvas and Sidebar */}
      <div className="flex-1 p-6 flex gap-4">
        {/* Canvas Container */}
        <div className="flex-1">
          <canvas
            ref={canvasRef}
            width={1400}
            height={700}
            onClick={handleCanvasClick}
            className={`w-full h-full border-4 border-white/50 rounded-lg shadow-2xl ${
              bucketPlacementMode ? 'cursor-crosshair' : 'cursor-crosshair'
            }`}
            style={{ display: "block" }}
          />
        </div>

        {/* Right Sidebar */}
        <div className="w-80 flex flex-col gap-4">
          {/* Instructions */}
          <div className="bg-white/90 backdrop-blur rounded-lg shadow-lg p-4">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              📋 Instructions
            </h3>
            <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
              <li>Select Line or Curve mode</li>
              <li>Click on canvas to create a path</li>
              <li>Click &quot;Complete Segment&quot; when done</li>
              <li>Click &quot;Place Bucket&quot; and position it on the ground</li>
              <li>Choose speed control mode</li>
              <li>Make predictions (optional)</li>
              <li>Adjust velocity & friction sliders</li>
              <li>Click &quot;Run Simulation&quot;</li>
              <li>Try to hit the bucket! 🎯</li>
            </ol>
          </div>

          {/* Bucket Status */}
          {bucket && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg shadow-lg p-4">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2 text-amber-800">
                🪣 Bucket Status
              </h3>
              <div className="text-sm text-amber-700">
                <p><strong>Position:</strong> X: {bucket.x.toFixed(0)}, Y: {bucket.y.toFixed(0)}</p>
                <p><strong>Size:</strong> {bucket.width} × {bucket.height}</p>
                <p><strong>Status:</strong> {bucket.isHit ? '✅ Hit!' : '⏳ Waiting...'}</p>
              </div>
            </div>
          )}

          {/* Prediction Panel */}
          {showPredictions && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg shadow-lg p-4">
              <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-purple-800">
                🎯 Make Your Predictions
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-purple-700 mb-1">
                    Initial Total Energy (J):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={predictions.initialTotalEnergy}
                    onChange={(e) => handlePredictionChange('initialTotalEnergy', e.target.value)}
                    disabled={isAnimating}
                    className="w-full px-3 py-2 border border-purple-300 rounded-md text-sm disabled:opacity-50"
                    placeholder="e.g., 5.2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-purple-700 mb-1">
                    Final Total Energy (J):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={predictions.finalTotalEnergy}
                    onChange={(e) => handlePredictionChange('finalTotalEnergy', e.target.value)}
                    disabled={isAnimating}
                    className="w-full px-3 py-2 border border-purple-300 rounded-md text-sm disabled:opacity-50"
                    placeholder="e.g., 2.8"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-purple-700 mb-1">
                    Energy Loss (J):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={predictions.energyLoss}
                    onChange={(e) => handlePredictionChange('energyLoss', e.target.value)}
                    disabled={isAnimating}
                    className="w-full px-3 py-2 border border-purple-300 rounded-md text-sm disabled:opacity-50"
                    placeholder="e.g., 2.4"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-purple-700 mb-1">
                    Efficiency (%):
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={predictions.efficiency}
                    onChange={(e) => handlePredictionChange('efficiency', e.target.value)}
                    disabled={isAnimating}
                    className="w-full px-3 py-2 border border-purple-300 rounded-md text-sm disabled:opacity-50"
                    placeholder="e.g., 65"
                  />
                </div>
                <div className="text-xs text-purple-600 mt-2 p-2 bg-purple-100 rounded-md">
                  💡 Tip: Predictions within ±{TOLERANCE_PERCENTAGE}% are considered correct!
                </div>
              </div>
            </div>
          )}

          {/* Real-Time Energy Display */}
          <div className="bg-white/90 backdrop-blur rounded-lg shadow-lg p-4 flex-1">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              ⚡ Energy Metrics
            </h3>

            {isAnimating && (
              <div className="mb-3 px-3 py-2 bg-green-100 border border-green-300 rounded-md">
                <p className="text-green-700 font-semibold text-sm text-center">
                  🎬 Live Data
                </p>
              </div>
            )}

            <div className="space-y-3">
              {/* Kinetic Energy */}
              <div className="bg-gradient-to-r from-red-50 to-red-100 p-3 rounded-lg border border-red-200">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-semibold text-red-900">
                    🏃 Kinetic Energy
                  </span>
                </div>
                <div className="text-2xl font-bold text-red-700">
                  {energyData.kineticEnergy.toFixed(2)}
                  <span className="text-sm ml-1">J</span>
                </div>
                <div className="text-xs text-red-600 mt-1">
                  ½mv² (motion energy)
                </div>
              </div>

              {/* Potential Energy */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-3 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-semibold text-blue-900">
                    ⛰️ Potential Energy
                  </span>
                </div>
                <div className="text-2xl font-bold text-blue-700">
                  {energyData.potentialEnergy.toFixed(2)}
                  <span className="text-sm ml-1">J</span>
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  mgh (height energy)
                </div>
              </div>

              {/* Total Energy */}
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-3 rounded-lg border border-purple-200">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-semibold text-purple-900">
                    💫 Total Energy
                  </span>
                </div>
                <div className="text-2xl font-bold text-purple-700">
                {energyData.totalEnergy.toFixed(2)}
                  <span className="text-sm ml-1">J</span>
                </div>
                <div className="text-xs text-purple-600 mt-1">KE + PE</div>
              </div>

              {/* Energy Loss */}
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-3 rounded-lg border border-orange-200">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-semibold text-orange-900">
                    🔥 Energy Loss
                  </span>
                </div>
                <div className="text-2xl font-bold text-orange-700">
                  {energyData.energyLoss.toFixed(2)}
                  <span className="text-sm ml-1">J</span>
                </div>
                <div className="text-xs text-orange-600 mt-1">
                  Due to friction
                </div>
              </div>
            </div>

            {/* Final Readings */}
            {finalEnergyData && !isAnimating && (
              <div className="mt-4 pt-4 border-t-2 border-gray-300">
                <h4 className="font-bold text-md mb-2 text-gray-800 flex items-center gap-2">
                  🎯 Final Readings
                </h4>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-300 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Kinetic:</span>
                    <span className="font-bold text-red-700">
                      {finalEnergyData.kineticEnergy.toFixed(2)} J
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Potential:</span>
                    <span className="font-bold text-blue-700">
                      {finalEnergyData.potentialEnergy.toFixed(2)} J
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Total:</span>
                    <span className="font-bold text-purple-700">
                      {finalEnergyData.totalEnergy.toFixed(2)} J
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-300">
                    <span className="text-gray-700 font-semibold">
                      Energy Lost:
                    </span>
                    <span className="font-bold text-orange-700">
                      {finalEnergyData.energyLoss.toFixed(2)} J
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Efficiency:</span>
                    <span className="font-semibold text-gray-800">
                      {(
                        ((initialEnergyRef.current -
                          finalEnergyData.energyLoss) /
                          initialEnergyRef.current) *
                        100
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-white/90 backdrop-blur border-t border-gray-200 py-2 px-6">
        <div className="max-w-7xl mx-auto text-center text-sm">
          {isAnimating ? (
            <p className="text-green-600 font-medium">
              🎬 Physics simulation running...
            </p>
          ) : bucketPlacementMode ? (
            <p className="text-amber-600 font-medium">
              🪣 Click on the ground to place the bucket
            </p>
          ) : (
            <p className="text-gray-700">
              Current points: {currentPoints.length} | Total segments:{" "}
              {path.length} | 
              {speedControlMode === "combined" 
                ? ` Velocity: ${initialVelocity.toFixed(1)}`
                : ` H-Speed: ${horizontalSpeed.toFixed(1)}, V-Speed: ${verticalSpeed.toFixed(1)}`
              } | Friction: {friction.toFixed(2)}
              {bucket && (
                <span className="ml-4 text-amber-600 font-medium">
                  | Bucket: Placed at ({bucket.x.toFixed(0)}, {bucket.y.toFixed(0)})
                </span>
              )}
              {predictionResults.length > 0 && (
                <span className="ml-4 text-purple-600 font-medium">
                  | Last Score: {predictionResults.filter(r => r.isCorrect).length}/{predictionResults.length} correct
                </span>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}