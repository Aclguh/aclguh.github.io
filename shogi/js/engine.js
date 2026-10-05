'use strict';
/* =====================================================================
 * 将棋 - Shogi 核心规则引擎
 * 职责：棋盘表示、走法生成、王手/将死判定、局面评估、Minimax AI 搜索
 * 纯逻辑实现，不依赖 DOM，可供浏览器与单元测试环境复用
 * ===================================================================== */

/* ---------- 1. 常量与配置 ---------- */
const ROWS = 9, COLS = 9;
const PIECE_TYPES = ['王','飞','角','金','银','桂','香','步'];       // 全部棋子类型
const HAND_TYPES  = ['飞','角','金','银','桂','香','步'];             // 可成为持駒的类型（王除外）

// 棋子基础价值（用于 AI 评估）
const BASE_VALUE = { 王:20000, 飞:1000, 角:880, 金:620, 银:560, 桂:420, 香:380, 步:100 };
// 升级后价值
const PROMOTED_VALUE = { 飞:1300, 角:1100, 银:640, 桂:520, 香:500, 步:430 };
// 升级后的显示名称
const PROMOTED_NAME = { 飞:'龙王', 角:'龙马', 银:'成银', 桂:'成桂', 香:'成香', 步:'と金' };
// 棋子全名（用于教程与提示文案）
const FULL_NAME = { 王:'王将 / 玉将', 飞:'飞车', 角:'角行', 金:'金将', 银:'银将', 桂:'桂马', 香:'香车', 步:'步兵' };

// 走法定义（以先手视角：dr=-1 表示向前/向上；后手自动镜像）
const STEP_MOVES = {
  王: [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]],  // 八方一格
  金: [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,0]],               // 六方一格（无斜后）
  银: [[-1,-1],[-1,0],[-1,1],[1,-1],[1,1]],                     // 五方一格
  桂: [[-2,-1],[-2,1]],                                          // 前跳二旁一
  步: [[-1,0]]                                                   // 前一格
};
const SLIDE_MOVES = {
  香: [[-1,0]],                                                  // 前方直线
  飞: [[-1,0],[1,0],[0,-1],[0,1]],                               // 十字直线
  角: [[-1,-1],[-1,1],[1,-1],[1,1]]                              // 斜线
};

// 预生成所有（类型 × 是否升级 × 阵营）的走法模式
const PATTERNS = {};
(function buildPatterns(){
  const flip = list => list.map(([dr,dc]) => [-dr,dc]); // 后手前后镜像
  for(const t of PIECE_TYPES){
    for(const p of [false,true]){
      let steps = null, slides = null;
      if(!p){
        if(STEP_MOVES[t]) steps = STEP_MOVES[t];
        if(SLIDE_MOVES[t]) slides = SLIDE_MOVES[t];
      }else{
        if(t === '飞'){ steps = [[-1,-1],[-1,1],[1,-1],[1,1]]; slides = SLIDE_MOVES.飞; }      // 龙王 = 飞 + 斜一格
        else if(t === '角'){ steps = [[-1,0],[1,0],[0,-1],[0,1]]; slides = SLIDE_MOVES.角; }   // 龙马 = 角 + 直一格
        else if(t === '王' || t === '金'){ steps = STEP_MOVES[t]; }                             // 不可升级（仅防御性兜底）
        else steps = STEP_MOVES.金;                                                            // 成银/成桂/成香/と金 = 金
      }
      PATTERNS[t + (p?'1':'0') + '1'] = { steps: steps ? steps.slice() : null, slides: slides ? slides.slice() : null };
      PATTERNS[t + (p?'1':'0') + '2'] = { steps: steps ? flip(steps) : null,      slides: slides ? flip(slides) : null };
    }
  }
})();
function movePattern(t,p,o){ return PATTERNS[t + (p?'1':'0') + o]; }

// 敌阵判断：owner=1（先手）的敌阵是 0~2 行；owner=2 是 6~8 行
function inZone(owner, r){ return owner === 1 ? r <= 2 : r >= 6; }
// 最后一行（不能再前进）：步兵/香车必须升级
function isLastRow(owner, r){ return owner === 1 ? r === 0 : r === 8; }
// 最后两行：桂马必须升级
function isLastTwo(owner, r){ return owner === 1 ? r <= 1 : r >= 7; }

/* 位置价值表（先手视角，后手按行镜像） */
const POS = {};      // 未升级棋子的位置加成
const POS_PROMOTED = [];  // 已升级棋子的通用位置加成
(function buildPosTables(){
  const center = (r,c) => 4 - Math.max(Math.abs(r-4), Math.abs(c-4)); // 0~4，越大越靠中
  for(const t of PIECE_TYPES){
    const tb = Array.from({length:9}, () => new Array(9).fill(0));
    for(let r=0;r<9;r++)for(let c=0;c<9;c++){
      const adv = 8 - r;                 // 前进程度（先手：越大越深入）
      const ct = center(r,c);
      let v = 0;
      switch(t){
        case '步': v = adv*5 + (r<=2?8:0); break;                    // 步兵越前越好
        case '香': v = adv*2 + (r<=2?4:0); break;
        case '桂': v = ct*4 + (adv>=4?6:0); break;
        case '银': v = ct*4 + adv*2; break;
        case '金': v = ct*4 + adv; break;
        case '角': v = ct*6 + (adv>=3?4:0); break;
        case '飞': v = ct*4 + (r<=2?6:0); break;
        case '王': v = (r>=7?12:(r>=5?4:-6)); break;                 // 王将早期待在自家后两行更安全
      }
      tb[r][c] = v;
    }
    POS[t] = tb;
  }
  for(let r=0;r<9;r++){ POS_PROMOTED[r] = []; for(let c=0;c<9;c++) POS_PROMOTED[r][c] = center(r,c)*4; }
})();

/* ---------- 2. 棋盘状态 ---------- */
function makeHand(){ return { 飞:0, 角:0, 金:0, 银:0, 桂:0, 香:0, 步:0 }; }

class GameState{
  constructor(){
    this.board = new Array(81).fill(null);   // 一维数组，index = r*9+c
    this.hands = { 1: makeHand(), 2: makeHand() };
    this.turn = 1;                            // 1=先手（下方），2=后手（上方）
  }
  at(r,c){ return this.board[r*9+c]; }
  set(r,c,p){ this.board[r*9+c] = p; }
  idx(r,c){ return r*9+c; }
  rowOf(i){ return Math.floor(i/9); }
  colOf(i){ return i%9; }
  findKing(o){
    for(let i=0;i<81;i++){ const p=this.board[i]; if(p && p.t==='王' && p.o===o) return i; }
    return -1;
  }
  clone(){
    const s = new GameState();
    s.board = this.board.map(p => p ? {t:p.t,o:p.o,p:p.p} : null);
    s.hands = { 1:{...this.hands[1]}, 2:{...this.hands[2]} };
    s.turn = this.turn;
    return s;
  }
  /* 执行一步棋，返回撤销记录（用于搜索与悔棋数据回滚） */
  makeMove(m){
    const undo = { m, captured:null, prevPromoted:false };
    if(m.drop){                                   // 打入
      this.board[m.to] = { t:m.drop, o:this.turn, p:false };
      this.hands[this.turn][m.drop]--;
    }else{                                        // 普通移动
      const piece = this.board[m.from];
      undo.captured = this.board[m.to];
      undo.prevPromoted = piece.p;
      if(undo.captured) this.hands[this.turn][undo.captured.t]++;   // 吃子进驹台（升级状态还原为基础类型）
      this.board[m.to] = piece;
      this.board[m.from] = null;
      if(m.promote) piece.p = true;
    }
    this.turn = 3 - this.turn;
    return undo;
  }
  /* 撤销一步棋 */
  unmakeMove(undo){
    this.turn = 3 - this.turn;
    const m = undo.m;
    if(m.drop){
      this.board[m.to] = null;
      this.hands[this.turn][m.drop]++;
    }else{
      const piece = this.board[m.to];
      piece.p = undo.prevPromoted;
      this.board[m.from] = piece;
      this.board[m.to] = undo.captured;
      if(undo.captured) this.hands[this.turn][undo.captured.t]--;
    }
  }
}

/* 标准初始布局：双方各 20 枚 */
function initialState(){
  const s = new GameState();
  const back = ['香','桂','银','金','王','金','银','桂','香'];
  for(let c=0;c<9;c++){
    s.set(0,c, {t:back[c],o:2,p:false});   // 后手底线
    s.set(8,c, {t:back[c],o:1,p:false});   // 先手底线
    s.set(2,c, {t:'步',o:2,p:false});      // 后手步兵线
    s.set(6,c, {t:'步',o:1,p:false});      // 先手步兵线
  }
  s.set(1,1,{t:'飞',o:2,p:false}); s.set(1,7,{t:'角',o:2,p:false});   // 后手：飞左角右
  s.set(7,1,{t:'角',o:1,p:false}); s.set(7,7,{t:'飞',o:1,p:false});   // 先手：角左飞右
  s.turn = 1;
  return s;
}

/* 序列化 / 反序列化（悔棋快照与局面哈希） */
function serializeState(s){
  return {
    b: s.board.map(p => p ? [p.t,p.o,p.p?1:0] : 0),
    h1: {...s.hands[1]}, h2: {...s.hands[2]},
    turn: s.turn
  };
}
function deserializeState(d){
  const s = new GameState();
  s.board = d.b.map(x => x ? {t:x[0],o:x[1],p:x[2]===1} : null);
  s.hands = { 1:{...d.h1}, 2:{...d.h2} };
  s.turn = d.turn;
  return s;
}
/* 局面键（用于千日手检测）：棋盘 + 双方驹台 + 行棋方 */
function stateKey(s){
  let k = '';
  for(let i=0;i<81;i++){
    const p = s.board[i];
    k += p ? (p.t + p.o + (p.p?'1':'0')) : '..';
  }
  k += '|' + JSON.stringify(s.hands) + '|' + s.turn;
  return k;
}

/* ---------- 3. 打入合法性（基本限制） ---------- */
/* 返回 true=该空格可打入；false=不可 */
function dropSquareLegalBasic(s, owner, t, idx){
  const r = Math.floor(idx/9), c = idx%9;
  if(s.board[idx]) return false;                                 // 只能打入空格
  if(t === '步'){                                                 // 二步禁手
    for(let r2=0;r2<9;r2++){
      const p = s.at(r2,c);
      if(p && p.o===owner && p.t==='步' && !p.p) return false;
    }
  }
  if((t === '步' || t === '香') && isLastRow(owner, r)) return false;   // 无法前进的位置
  if(t === '桂' && isLastTwo(owner, r)) return false;
  return true;
}
/* 打入被拒原因（用于 UI 提示） */
function dropRejectionReason(s, owner, t, r, c){
  if(s.at(r,c)) return '只能打入到空格上';
  if(t === '步'){
    for(let r2=0;r2<9;r2++){ const p=s.at(r2,c); if(p&&p.o===owner&&p.t==='步'&&!p.p) return '二步禁手：这一列已有己方步兵'; }
    if(isLastRow(owner,r)) return '步兵不能打入最后一行（将无法移动）';
  }
  if(t === '香' && isLastRow(owner,r)) return '香车不能打入最后一行（将无法移动）';
  if(t === '桂' && isLastTwo(owner,r)) return '桂马不能打入最后两行（将无法移动）';
  return null;
}

/* ---------- 4. 攻击检测（王手判定核心） ---------- */
const DIRS_ORTHO = [[-1,0],[1,0],[0,-1],[0,1]];
const DIRS_DIAG  = [[-1,-1],[-1,1],[1,-1],[1,1]];

/* (r,c) 是否被 by 方攻击（快速射线法） */
function isSquareAttacked(s, r, c, by){
  const b = s.board;
  // 桂马跳跃攻击
  const KN = [[-2,-1],[-2,1],[2,-1],[2,1]];
  for(let k=0;k<4;k++){
    const ar = r+KN[k][0], ac = c+KN[k][1];
    if(ar<0||ar>8||ac<0||ac>8) continue;
    const p = b[ar*9+ac];
    if(p && p.o===by && p.t==='桂' && !p.p){
      if((by===1 && ar-r===-2) || (by===2 && ar-r===2)) return true;
    }
  }
  // 八方向射线：贴身一步棋子 + 远处滑行棋子
  for(let i=0;i<8;i++){
    const dr = i<4 ? DIRS_ORTHO[i][0] : DIRS_DIAG[i-4][0];
    const dc = i<4 ? DIRS_ORTHO[i][1] : DIRS_DIAG[i-4][1];
    let ar = r+dr, ac = c+dc, dist = 1;
    while(ar>=0 && ar<9 && ac>=0 && ac<9){
      const p = b[ar*9+ac];
      if(p){
        if(p.o === by){
          const pat = movePattern(p.t, p.p, by);
          const back = [-dr,-dc];                    // 从攻击者指向目标格的方向
          if(dist === 1 && pat.steps){
            for(let q=0;q<pat.steps.length;q++){
              if(pat.steps[q][0]===back[0] && pat.steps[q][1]===back[1]) return true;
            }
          }
          if(pat.slides){
            for(let q=0;q<pat.slides.length;q++){
              if(pat.slides[q][0]===back[0] && pat.slides[q][1]===back[1]) return true;
            }
          }
        }
        break;                                        // 被任意棋子挡住
      }
      ar += dr; ac += dc; dist++;
    }
  }
  return false;
}
/* owner 的王是否被将军 */
function isInCheck(s, owner){
  const k = s.findKing(owner);
  if(k < 0) return false;
  return isSquareAttacked(s, Math.floor(k/9), k%9, 3-owner);
}

/* ---------- 5. 走法生成 ---------- */
function generatePseudoMoves(s, owner, opts){
  owner = owner || s.turn;
  opts = opts || {};
  const capturesOnly = !!opts.capturesOnly;
  const auto = !opts.manual;
  const moves = [];
  const b = s.board;
  for(let i=0;i<81;i++){
    const p = b[i];
    if(!p || p.o !== owner) continue;
    const r = Math.floor(i/9), c = i%9;
    const pat = movePattern(p.t, p.p, owner);
    const canPromoteType = p.t !== '王' && p.t !== '金' && !p.p;
    const push = (to) => {
      const tr = Math.floor(to/9);
      let promotable = false, forced = false;
      if(canPromoteType && (inZone(owner, r) || inZone(owner, tr))){
        promotable = true;
        if((p.t==='步'||p.t==='香') && isLastRow(owner, tr)) forced = true;   // 强制升级
        if(p.t==='桂' && isLastTwo(owner, tr)) forced = true;
      }
      moves.push({ from:i, to, drop:null, promote: forced || (promotable && auto), promotable, forced });
    };
    if(pat.steps){
      for(let q=0;q<pat.steps.length;q++){
        const nr = r + pat.steps[q][0], nc = c + pat.steps[q][1];
        if(nr<0||nr>8||nc<0||nc>8) continue;
        const t = b[nr*9+nc];
        if(t && t.o === owner) continue;             // 不能吃己方
        if(capturesOnly && !t) continue;
        push(nr*9+nc);
      }
    }
    if(pat.slides){
      for(let q=0;q<pat.slides.length;q++){
        let nr = r + pat.slides[q][0], nc = c + pat.slides[q][1];
        while(nr>=0&&nr<9&&nc>=0&&nc<9){
          const t = b[nr*9+nc];
          if(t && t.o === owner) break;
          if(!capturesOnly || t) push(nr*9+nc);
          if(t) break;                               // 滑行棋子不能越子
          nr += pat.slides[q][0]; nc += pat.slides[q][1];
        }
      }
    }
  }
  if(!capturesOnly){
    const hand = s.hands[owner];
    for(const t of HAND_TYPES){
      if(hand[t] <= 0) continue;
      for(let i=0;i<81;i++){
        if(b[i]) continue;
        if(!dropSquareLegalBasic(s, owner, t, i)) continue;
        moves.push({ from:-1, to:i, drop:t, promote:false, promotable:false, forced:false });
      }
    }
  }
  return moves;
}

/*
 * 生成完全合法走法（过滤送王 + 打步诘）。
 */
function generateLegalMoves(s, owner, manual){
  owner = owner || s.turn;
  const out = [];
  const pseudo = generatePseudoMoves(s, owner, { manual: !!manual });
  for(const m of pseudo){
    const u = s.makeMove(m);
    let ok = !isInCheck(s, owner);                    // 走完自己王不能被将
    if(ok && m.drop === '步'){                        // 打步诘：用步兵打入直接将死对方 → 非法
      const opp = 3 - owner;
      if(isInCheck(s, opp)){
        let hasReply = false;
        const replies = generatePseudoMoves(s, opp, { manual:true });
        for(const rm of replies){
          const ru = s.makeMove(rm);
          const good = !isInCheck(s, opp);
          s.unmakeMove(ru);
          if(good){ hasReply = true; break; }
        }
        if(!hasReply) ok = false;
      }
    }
    s.unmakeMove(u);
    if(ok) out.push(m);
  }
  return out;
}

/* 合法走法数统计（测试用 perft） */
function perft(s, depth){
  if(depth === 0) return 1;
  const moves = generateLegalMoves(s, s.turn, true);
  if(depth === 1) return moves.length;
  let n = 0;
  for(const m of moves){
    const u = s.makeMove(m);
    n += perft(s, depth-1);
    s.unmakeMove(u);
  }
  return n;
}

/* ---------- 6. 局面评估（先手视角，正 = 先手优） ---------- */
function evaluate(s){
  let sc = 0;
  for(let i=0;i<81;i++){
    const p = s.board[i];
    if(!p) continue;
    const r = Math.floor(i/9), c = i%9;
    let v = p.p ? PROMOTED_VALUE[p.t] : BASE_VALUE[p.t];
    v += p.p ? POS_PROMOTED[r][c] : (p.o===1 ? POS[p.t][r][c] : POS[p.t][8-r][c]);
    sc += (p.o === 1) ? v : -v;
  }
  for(const t of HAND_TYPES){
    const hv = BASE_VALUE[t] + 20;                    // 持駒价值略高（灵活）
    sc += (s.hands[1][t] - s.hands[2][t]) * hv;
  }
  return sc;
}
function evaluateFor(s, me){ return me === 1 ? evaluate(s) : -evaluate(s); }

/* ---------- 7. AI 搜索：Minimax（negamax）+ α-β 剪枝 + 迭代加深 ---------- */
const MATE = 100000;
const SEARCH_ABORT = { abort:true };
let searchNodes = 0, searchDeadline = 0;

/* 历史启发表（提高剪枝效率的走法排序辅助） */
const HISTORY = new Int32Array(6800);
function histKey(m){
  if(m.drop) return 6700 + HAND_TYPES.indexOf(m.drop);
  return (m.from+1)*81 + m.to;
}
/* 走法排序：吃子（MVV-LVA）> 升级 > 历史分 */
function orderMoves(s, moves){
  const b = s.board;
  for(const m of moves){
    let sc = 0;
    const tgt = m.drop ? null : b[m.to];
    if(tgt){ sc += 10000 + BASE_VALUE[tgt.t]*8 - (BASE_VALUE[b[m.from].t]>>3); }
    if(m.drop) sc += 60 + BASE_VALUE[m.drop];
    if(m.promote) sc += 8000;
    sc += HISTORY[histKey(m)];
    m.score = sc;
  }
  moves.sort((a,b2) => b2.score - a.score);
}

/* 静态搜索 */
function quiesce(s, alpha, beta, ply){
  if((++searchNodes & 511) === 0 && Date.now() >= searchDeadline) throw SEARCH_ABORT;
  if(s.findKing(s.turn) < 0) return -(MATE - ply);     // 王已被吃（上一步非法送王）
  const me = s.turn;
  const stand = evaluateFor(s, me);
  if(stand >= beta) return stand;
  if(stand > alpha) alpha = stand;
  if(ply >= 64) return stand;
  const moves = generatePseudoMoves(s, me, { capturesOnly:true });
  orderMoves(s, moves);
  for(const m of moves){
    const tgt = s.board[m.to];
    if(tgt && tgt.t === '王') return MATE - ply;       // 可直接吃王
    const u = s.makeMove(m);
    const v = -quiesce(s, -beta, -alpha, ply+1);
    s.unmakeMove(u);
    if(v >= beta) return v;
    if(v > alpha) alpha = v;
  }
  return alpha;
}

/* negamax 主搜索 */
function negamax(s, depth, alpha, beta, ply){
  if((++searchNodes & 511) === 0 && Date.now() >= searchDeadline) throw SEARCH_ABORT;
  if(s.findKing(s.turn) < 0) return -(MATE - ply);
  if(depth <= 0) return quiesce(s, alpha, beta, ply);
  if(ply >= 80) return evaluateFor(s, s.turn);
  const me = s.turn;
  const moves = generatePseudoMoves(s, me, {});        // 搜索用伪合法走法
  orderMoves(s, moves);
  let best = -Infinity, any = false;
  for(const m of moves){
    const tgt = s.board[m.to];
    if(tgt && tgt.t === '王') return MATE - ply;       // 直接吃王 = 上层非法
    const u = s.makeMove(m);
    const v = -negamax(s, depth-1, -beta, -alpha, ply+1);
    s.unmakeMove(u);
    any = true;
    if(v > best) best = v;
    if(best > alpha) alpha = best;
    if(alpha >= beta){                                 // β剪枝
      const hk = histKey(m);
      HISTORY[hk] += depth*depth;
      break;
    }
  }
  if(!any) return evaluateFor(s, me);
  return best;
}

/* 难度配置 */
const AI_LEVELS = {
  easy:   { depth:2, time:400,  random:true, wide:150 },  // 简单：随机 + 浅层搜索
  medium: { depth:4, time:1200 },                         // 中等：4层 α-β
  hard:   { depth:6, time:3200 }                          // 困难：最多6层 + 走法排序
};

/* AI 选择走法 */
function aiChooseMove(srcState, level){
  const cfg = AI_LEVELS[level] || AI_LEVELS.medium;
  const s = srcState.clone();
  const rootMoves = generateLegalMoves(s, s.turn, true);
  if(rootMoves.length === 0) return null;
  for(const m of rootMoves){ if(m.promotable) m.promote = true; }   // AI 一律升级
  if(cfg.random && Math.random() < 0.3){
    return { move: rootMoves[(Math.random()*rootMoves.length)|0], depth:0, random:true };
  }
  searchNodes = 0;
  searchDeadline = Date.now() + cfg.time;
  orderMoves(s, rootMoves);
  let bestOverall = rootMoves[0], completed = 0, lastScored = null;
  for(let d=1; d<=cfg.depth; d++){
    let alpha = -Infinity, bestThis = null;
    const scored = [];
    try{
      for(const m of rootMoves){
        const u = s.makeMove(m);
        const v = -negamax(s, d-1, -Infinity, -alpha, 1);
        s.unmakeMove(u);
        scored.push({ m, v });
        if(v > alpha){ alpha = v; bestThis = m; }
        if(alpha >= MATE - 100) break;
      }
    }catch(e){
      if(e !== SEARCH_ABORT) throw e;
      break;
    }
    if(bestThis){
      bestOverall = bestThis;
      completed = d;
      lastScored = scored;
      scored.sort((a,b2) => b2.v - a.v);
      rootMoves.length = 0;
      for(const x of scored) rootMoves.push(x.m);
    }
    if(alpha >= MATE - 100) break;
  }
  let chosen = bestOverall;
  if(cfg.random && cfg.wide && lastScored && lastScored.length > 1){
    const best = lastScored[0].v;
    const pool = lastScored.filter(x => x.v >= best - cfg.wide && x.v > -(MATE-100));
    if(pool.length) chosen = pool[(Math.random()*pool.length)|0].m;
  }
  return { move: chosen, depth: completed };
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ROWS, COLS, PIECE_TYPES, HAND_TYPES, BASE_VALUE, PROMOTED_VALUE, PROMOTED_NAME, FULL_NAME,
    GameState, initialState, serializeState, deserializeState, stateKey,
    dropSquareLegalBasic, dropRejectionReason, isSquareAttacked, isInCheck,
    generatePseudoMoves, generateLegalMoves, perft, evaluate, aiChooseMove
  };
}
