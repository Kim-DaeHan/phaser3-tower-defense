import Phaser from 'phaser';

const ENEMY_SPEED = 1 / 10000;
const BULLET_DAMAGE = 50;

const map = [
  [0, -1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, -1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, -1, -1, -1, -1, -1, -1, -1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, -1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, -1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, -1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, -1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, -1, 0, 0],
];

type ArcadePhysicsCallback = (object1: Phaser.GameObjects.GameObject, object2: Phaser.GameObjects.GameObject) => void;

export class MainScene extends Phaser.Scene {
  public path!: Phaser.Curves.Path;
  private turrets!: Phaser.GameObjects.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;
  private nextEnemy = 0;

  constructor() {
    super({ key: 'main' });
  }

  preload() {
    this.load.atlas('sprites', 'assets/spritesheet.png', 'assets/spritesheet.json');
    this.load.image('bullet', 'assets/bullet.png');
  }

  create() {
    const graphics = this.add.graphics();
    this.drawLines(graphics);
    this.path = this.add.path(96, -32);
    this.path.lineTo(96, 164);
    this.path.lineTo(480, 164);
    this.path.lineTo(480, 544);

    graphics.lineStyle(2, 0xffffff, 1);
    this.path.draw(graphics);

    this.enemies = this.physics.add.group({ classType: Enemy, runChildUpdate: true });
    this.turrets = this.add.group({ classType: Turret, runChildUpdate: true });
    this.bullets = this.physics.add.group({ classType: Bullet, runChildUpdate: true });

    this.physics.add.overlap(
      this.enemies,
      this.bullets,
      this.damageEnemy as unknown as ArcadePhysicsCallback,
      undefined,
      this,
    );
    this.input.on('pointerdown', this.placeTurret, this);
  }

  update(time: number, delta: number) {
    if (time > this.nextEnemy) {
      const enemy = this.enemies.get() as Enemy;
      if (enemy) {
        enemy.setActive(true);
        enemy.setVisible(true);
        enemy.startOnPath(this.path);

        this.nextEnemy = time + 2000;
      }
    }
  }

  private damageEnemy(enemy: Phaser.GameObjects.GameObject, bullet: Phaser.GameObjects.GameObject) {
    const castedEnemy = enemy as Enemy;
    const castedBullet = bullet as Bullet;

    if (castedEnemy.active && castedBullet.active) {
      castedBullet.setActive(false);
      castedBullet.setVisible(false);
      castedEnemy.receiveDamage(BULLET_DAMAGE);
    }
  }

  private drawLines(graphics: Phaser.GameObjects.Graphics) {
    graphics.lineStyle(1, 0x0000ff, 0.8);
    for (let i = 0; i < 8; i++) {
      graphics.moveTo(0, i * 64);
      graphics.lineTo(640, i * 64);
    }
    for (let j = 0; j < 10; j++) {
      graphics.moveTo(j * 64, 0);
      graphics.lineTo(j * 64, 512);
    }
    graphics.strokePath();
  }

  private canPlaceTurret(i: number, j: number): boolean {
    return map[i][j] === 0;
  }

  private placeTurret(pointer: Phaser.Input.Pointer) {
    const i = Math.floor(pointer.y / 64);
    const j = Math.floor(pointer.x / 64);
    if (this.canPlaceTurret(i, j)) {
      const turret = this.turrets.get() as Turret;
      if (turret) {
        turret.setActive(true);
        turret.setVisible(true);
        turret.place(i, j);
      }
    }
  }

  public addBullet(x: number, y: number, angle: number) {
    const bullet = this.bullets.get() as Bullet;
    if (bullet) {
      bullet.fire(x, y, angle);
    }
  }

  public getEnemy(x: number, y: number, distance: number): Enemy | false {
    const enemyUnits = this.enemies.getChildren() as Enemy[];
    for (const enemy of enemyUnits) {
      if (enemy.active && Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) < distance) {
        return enemy;
      }
    }
    return false;
  }
}

class Enemy extends Phaser.GameObjects.Image {
  private follower: { t: number; vec: Phaser.Math.Vector2 };
  public hp: number;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'sprites', 'enemy');
    this.follower = { t: 0, vec: new Phaser.Math.Vector2() };
    this.hp = 0;
  }

  public startOnPath(path: Phaser.Curves.Path) {
    this.follower.t = 0;
    this.hp = 100;

    path.getPoint(this.follower.t, this.follower.vec);
    this.setPosition(this.follower.vec.x, this.follower.vec.y);
  }

  public receiveDamage(damage: number) {
    this.hp -= damage;

    if (this.hp <= 0) {
      this.setActive(false);
      this.setVisible(false);
    }
  }

  public update(time: number, delta: number) {
    this.follower.t += ENEMY_SPEED * delta;
    (this.scene as MainScene).path.getPoint(this.follower.t, this.follower.vec);

    this.setPosition(this.follower.vec.x, this.follower.vec.y);

    if (this.follower.t >= 1) {
      this.setActive(false);
      this.setVisible(false);
    }
  }
}

class Turret extends Phaser.GameObjects.Image {
  private nextTic = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'sprites', 'turret');
  }

  public place(i: number, j: number) {
    this.y = i * 64 + 64 / 2;
    this.x = j * 64 + 64 / 2;
    map[i][j] = 1;
  }

  public fire() {
    const enemy = (this.scene as MainScene).getEnemy(this.x, this.y, 200);
    if (enemy) {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, enemy.x, enemy.y);
      (this.scene as MainScene).addBullet(this.x, this.y, angle);
      this.angle = (angle + Math.PI / 2) * Phaser.Math.RAD_TO_DEG;
    }
  }

  public update(time: number, delta: number) {
    if (time > this.nextTic) {
      this.fire();
      this.nextTic = time + 1000;
    }
  }
}

class Bullet extends Phaser.GameObjects.Image {
  private dx = 0;
  private dy = 0;
  private lifespan = 0;
  private speed = Phaser.Math.GetSpeed(600, 1);

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'bullet');
  }

  public fire(x: number, y: number, angle: number) {
    this.setActive(true);
    this.setVisible(true);
    this.setPosition(x, y);

    this.dx = Math.cos(angle);
    this.dy = Math.sin(angle);

    this.lifespan = 1000;
  }

  public update(time: number, delta: number) {
    this.lifespan -= delta;

    this.x += this.dx * (this.speed * delta);
    this.y += this.dy * (this.speed * delta);

    if (this.lifespan <= 0) {
      this.setActive(false);
      this.setVisible(false);
    }
  }
}
