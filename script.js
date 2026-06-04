const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

canvas.width = 600;
canvas.height = 600;

let cols, rows, cellSize;
let maze = [];

let player, enemy;
let coins = new Set();

let exitCell;

let timeLeft = 0;
let score = 0;
let coinCount = 0;

let gameState = "menu";

let fog = new Set();

/* ---------------- DIFFICULTY ---------------- */
function setDifficulty(d) {
  if (d === "easy") {
    cols = rows = 15;
    timeLeft = 120;
  }
  if (d === "medium") {
    cols = rows = 25;
    timeLeft = 90;
  }
  if (d === "hard") {
    cols = rows = 35;
    timeLeft = 60;
  }

  cellSize = canvas.width / cols;
}

/* ---------------- CELL ---------------- */
class Cell {
  constructor(x,y){
    this.x=x;this.y=y;
    this.walls=[1,1,1,1];
    this.visited=false;
  }
}

/* ---------------- MAZE DFS ---------------- */
function generateMaze() {
  maze = Array.from({length: rows}, (_,y)=>
    Array.from({length: cols}, (_,x)=>new Cell(x,y))
  );

  let stack = [];
  let start = maze[0][0];
  start.visited = true;
  stack.push(start);

  while(stack.length){
    let current = stack.pop();

    let n = neighbors(current);
    if(n.length){
      stack.push(current);

      let next = n[Math.random()*n.length|0];
      removeWalls(current,next);
      next.visited=true;
      stack.push(next);
    }
  }

  exitCell = maze[rows-1][cols-1];
}

/* ---------------- NEIGHBORS ---------------- */
function neighbors(c){
  let n=[];
  let {x,y}=c;

  if(y>0 && !maze[y-1][x].visited) n.push(maze[y-1][x]);
  if(x<cols-1 && !maze[y][x+1].visited) n.push(maze[y][x+1]);
  if(y<rows-1 && !maze[y+1][x].visited) n.push(maze[y+1][x]);
  if(x>0 && !maze[y][x-1].visited) n.push(maze[y][x-1]);

  return n;
}

/* ---------------- REMOVE WALLS ---------------- */
function removeWalls(a,b){
  let dx=a.x-b.x;
  let dy=a.y-b.y;

  if(dx===1){a.walls[3]=0;b.walls[1]=0;}
  if(dx===-1){a.walls[1]=0;b.walls[3]=0;}
  if(dy===1){a.walls[0]=0;b.walls[2]=0;}
  if(dy===-1){a.walls[2]=0;b.walls[0]=0;}
}

/* ---------------- INIT GAME ---------------- */
function startGame(d){
  document.getElementById("menu").style.display="none";

  setDifficulty(d);
  generateMaze();

  player={x:0,y:0};
  enemy={x:cols-1,y:0};

  score=0;
  coinCount=0;

  spawnCoins();

  gameState="play";

  timer();
  loop();
}

/* ---------------- COINS ---------------- */
function spawnCoins(){
  for(let i=0;i<Math.floor(cols);i++){
    let x=Math.random()*cols|0;
    let y=Math.random()*rows|0;
    coins.add(x+","+y);
  }
}

/* ---------------- INPUT ---------------- */
document.addEventListener("keydown",e=>{
  if(gameState!=="play")return;

  let c=maze[player.y][player.x];

  let nx=player.x,ny=player.y;

  if(e.key==="ArrowUp"&&!c.walls[0])ny--;
  if(e.key==="ArrowRight"&&!c.walls[1])nx++;
  if(e.key==="ArrowDown"&&!c.walls[2])ny++;
  if(e.key==="ArrowLeft"&&!c.walls[3])nx--;

  if(valid(nx,ny)){
    player.x=nx;player.y=ny;
  }

  collect();
  checkWin();
});

/* ---------------- VALID ---------------- */
function valid(x,y){
  return x>=0&&y>=0&&x<cols&&y<rows;
}

/* ---------------- COIN COLLECT ---------------- */
function collect(){
  let k=player.x+","+player.y;
  if(coins.has(k)){
    coins.delete(k);
    score+=10;
    coinCount++;
  }
}

/* ---------------- BFS (HINT) ---------------- */
function bfs(start,end){
  let q=[start];
  let vis=new Set();
  let par={};

  vis.add(start.x+","+start.y);

  while(q.length){
    let c=q.shift();

    if(c.x===end.x&&c.y===end.y)break;

    for(let n of getMoves(c)){
      let k=n.x+","+n.y;
      if(!vis.has(k)){
        vis.add(k);
        par[k]=c;
        q.push(n);
      }
    }
  }

  return par;
}

/* ---------------- A* ENEMY AI ---------------- */
function heuristic(a,b){
  return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
}

function astar(){
  let open=[enemy];
  let came={};
  let g={};
  let f={};

  let key=(n)=>n.x+","+n.y;

  g[key(enemy)]=0;
  f[key(enemy)]=heuristic(enemy,player);

  while(open.length){
    let cur=open.shift();

    if(cur.x===player.x&&cur.y===player.y)return;

    for(let n of getMoves(cur)){
      let k=key(n);
      let tg=(g[key(cur)]||0)+1;

      if(g[k]===undefined||tg<g[k]){
        came[k]=cur;
        g[k]=tg;
        f[k]=tg+heuristic(n,player);
        open.push(n);
      }
    }
  }

  enemyStep(came);
}

function enemyStep(came){
  let k=player.x+","+player.y;
  let path=[];

  while(came[k]){
    path.push(came[k]);
    k=came[k].x+","+came[k].y;
  }

  if(path.length){
    enemy=path[path.length-1];
  }
}

/* ---------------- MOVES ---------------- */
function getMoves(c){
  let m=[];
  let cell=maze[c.y][c.x];

  if(!cell.walls[0])m.push({x:c.x,y:c.y-1});
  if(!cell.walls[1])m.push({x:c.x+1,y:c.y});
  if(!cell.walls[2])m.push({x:c.x,y:c.y+1});
  if(!cell.walls[3])m.push({x:c.x-1,y:c.y});

  return m;
}

/* ---------------- TIMER ---------------- */
function timer(){
  setInterval(()=>{
    if(gameState!=="play")return;

    timeLeft--;
    document.getElementById("time").innerText=timeLeft;

    if(timeLeft<=0)lose();
  },1000);
}

/* ---------------- WIN/LOSE ---------------- */
function checkWin(){
  if(player.x===cols-1&&player.y===rows-1){
    win();
  }
}

function win(){
  gameState="end";
  saveBest();
  show("YOU WIN!");
}

function lose(){
  gameState="end";
  show("GAME OVER");
}

function show(t){
  document.getElementById("overlay").innerText=t;
}

/* ---------------- BEST SCORE ---------------- */
function saveBest(){
  let best=localStorage.getItem("best")||0;
  if(score>best){
    localStorage.setItem("best",score);
  }
}

/* ---------------- LOOP ---------------- */
function loop(){
  if(gameState!=="play")return;

  astar();

  if(player.x===enemy.x&&player.y===enemy.y){
    lose();
    return;
  }

  draw();
  requestAnimationFrame(loop);
}

/* ---------------- DRAW ---------------- */
function draw(){
  ctx.clearRect(0,0,600,600);

  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){

      let c=maze[y][x];
      let px=x*cellSize;
      let py=y*cellSize;

      ctx.strokeStyle="#1de9b6";

      if(c.walls[0])line(px,py,px+cellSize,py);
      if(c.walls[1])line(px+cellSize,py,px+cellSize,py+cellSize);
      if(c.walls[2])line(px+cellSize,py+cellSize,px,py+cellSize);
      if(c.walls[3])line(px,py+cellSize,px,py);
    }
  }

  // coins
  coins.forEach(k=>{
    let [x,y]=k.split(",").map(Number);
    ctx.fillStyle="gold";
    ctx.fillRect(x*cellSize+5,y*cellSize+5,10,10);
  });

  // exit
  ctx.fillStyle="green";
  ctx.fillRect((cols-1)*cellSize,(rows-1)*cellSize,cellSize,cellSize);

  // player
  ctx.fillStyle="cyan";
  ctx.fillRect(player.x*cellSize,player.y*cellSize,cellSize,cellSize);

  // enemy
  ctx.fillStyle="red";
  ctx.fillRect(enemy.x*cellSize,enemy.y*cellSize,cellSize,cellSize);
}

function line(x1,y1,x2,y2){
  ctx.beginPath();
  ctx.moveTo(x1,y1);
  ctx.lineTo(x2,y2);
  ctx.stroke();
}
function restartGame() {
  score = 0;
  coinCount = 0;
  timeLeft = 0;

  gameState = "menu";

  player = { x: 0, y: 0 };
  enemy = { x: 0, y: 0 };

  maze = [];
  coins = new Set();

  document.getElementById("menu").style.display = "flex";
  document.getElementById("overlay").innerText = "";
}