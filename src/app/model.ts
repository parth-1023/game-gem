// src/model.ts

// A simple vector class for position and velocity
export class Vector {
    constructor(public x: number, public y: number) {}
}

// Enums for managing state and types
export enum SimulationState {
    Ready,
    Running,
    Finished,
}

export enum SegmentType {
    Straight,
    Curve,
}

export class Ball {
    mass: number;
    position: Vector;
    velocity: Vector;

    constructor(mass: number, position: Vector) {
        this.mass = mass;
        this.position = position;
        this.velocity = new Vector(0, 0);
    }

    getKineticEnergy(): number {
        const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
        return 0.5 * this.mass * speed ** 2;
    }

    getPotentialEnergy(gravity: number): number {
        return this.mass * gravity * this.position.y;
    }
}

export class PathSegment {
    type: SegmentType;
    length: number;
    angle: number; // in radians
    frictionCoefficient: number;

    constructor(type: SegmentType, length: number, angle: number, friction: number) {
        this.type = type;
        this.length = length;
        this.angle = angle;
        this.frictionCoefficient = friction;
    }
}

export class Path {
    segments: PathSegment[] = [];

    addSegment(segment: PathSegment) {
        this.segments.push(segment);
    }
}

export class SimulationModel {
    path: Path;
    ball: Ball;
    currentState: SimulationState;
    budget: number;
    totalEnergy: number = 0;
    energyLoss: number = 0;
    
    private readonly GRAVITY = 9.81;

    constructor() {
        this.path = new Path();
        this.ball = new Ball(1, new Vector(0, 100));
        this.currentState = SimulationState.Ready;
        this.budget = 1000;
    }

    updateState(deltaTime: number) {
        if (this.currentState !== SimulationState.Running) return;

        const segment = this.path.segments[0];
        if (!segment) {
            this.currentState = SimulationState.Finished;
            return;
        }

        const angle = segment.angle;
        const frictionCoeff = segment.frictionCoefficient;

        const forceGravity = this.GRAVITY * Math.sin(angle);
        const normalForce = this.GRAVITY * Math.cos(angle);
        const forceFriction = normalForce * frictionCoeff;
        
        const netForce = forceGravity - forceFriction;
        const acceleration = netForce; 

        const currentSpeed = this.ball.velocity.x;
        const newSpeed = currentSpeed + acceleration * deltaTime;
        const distanceMoved = newSpeed * deltaTime;
        
        this.ball.velocity.x = newSpeed;
        this.ball.position.x += distanceMoved * Math.cos(angle);
        this.ball.position.y -= distanceMoved * Math.sin(angle);

        this.energyLoss += forceFriction * distanceMoved * this.ball.mass;
        
        if (this.ball.position.y <= 0) {
            this.ball.position.y = 0;
            this.currentState = SimulationState.Finished;
        }
    }

    reset() {
        this.ball = new Ball(1, new Vector(0, 100));
        this.currentState = SimulationState.Ready;
        this.energyLoss = 0;
        console.log("Simulation has been reset.");
    }
}