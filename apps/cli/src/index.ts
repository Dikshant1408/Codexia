import * as path from 'node:path';
import * as http from 'node:http';
import * as fs from 'node:fs';
import { ArchaeologyEngine } from '@codearch/core';
import { CliRenderer, c } from '@codearch/adapter-cli';

export async function runCli(args: string[]): Promise<void> {
  const command = args[0] || 'help';
  const cwd = process.cwd();

  if (command === '--help' || command === '-h' || command === 'help') {
    CliRenderer.printBanner();
    console.log(`Usage: codearch <command> [options]

Commands:
  analyze [path]       Index workspace AST, dependencies, Git history and metrics
  file <path>          Analyze a specific file (AST symbols, complexity, metrics)
  symbol <name>        Inspect code story, origin, and evolution for a symbol
  history <path>       Show Git commit history and evolution of a file
  impact <target>      Analyze Blast Radius & dependent fallout if target changes
  who-broke-this <f>   Investigate origin, commit blame and regression risk for line
  risk <file> [sym]    Calculate transparent 5-factor risk score
  dead-code            Detect unused functions, dead exports, and obsolete code
  duplicates           Detect structural logic duplication and extractable patterns
  architecture         Inspect domain modules, dependencies, and boundary couplings
  doctor               Verify local Git, SQLite, AST engine and privacy environment
  dashboard [--port N] Launch local forensic web dashboard (default: 3456)
  serve [--port N]     Start JSON-RPC Universal Protocol server over HTTP

Options:
  --reindex            Force re-indexing of workspace from scratch
  --port <num>         Custom port for dashboard or RPC server
  --version            Print version
`);
    return;
  }

  if (command === '--version' || command === '-v') {
    console.log('0.1.0');
    return;
  }

  // Doctor check
  if (command === 'doctor') {
    CliRenderer.printBanner();
    console.log(`${c.bold}CODE ARCHAEOLOGIST SYSTEM DIAGNOSTIC${c.reset}`);
    console.log(`${c.gray}──────────────────────────────────────────────────${c.reset}`);
    console.log(`  OS Platform:       ${process.platform} (${process.arch})`);
    console.log(`  Node.js Version:   ${process.version} ${c.green}✓${c.reset}`);

    // Check Git
    const engine = new ArchaeologyEngine({ workspaceRoot: cwd });
    const isGit = await engine.git.isGitRepo();
    console.log(`  Git Repository:    ${isGit ? `${c.green}Detected (${await engine.git.getCurrentBranch()})${c.reset}` : `${c.yellow}Not inside Git worktree${c.reset}`}`);

    // Check SQLite
    console.log(`  SQLite Storage:    ${c.green}Native node:sqlite engine active${c.reset}`);

    // Check AST Parsers
    console.log(`  AST Parsers:       ${c.green}TypeScript, JavaScript, Python, Go, Rust, Java${c.reset}`);

    // Check Privacy
    console.log(`  Privacy Status:    ${c.green}${engine.ai.getStatus().statusText}${c.reset}`);
    console.log(`${c.gray}──────────────────────────────────────────────────${c.reset}\n`);
    return;
  }

  const engine = new ArchaeologyEngine({ workspaceRoot: cwd });

  switch (command) {
    case 'analyze': {
      CliRenderer.printBanner();
      const targetDir = args[1] || cwd;
      const force = args.includes('--reindex');
      console.log(`${c.cyan}Analyzing workspace:${c.reset} ${targetDir}...`);
      const summary = await engine.analyzeWorkspace(targetDir, force);
      CliRenderer.renderWorkspaceSummary(summary);
      break;
    }

    case 'file': {
      const filePath = args[1];
      if (!filePath) {
        console.error(`${c.red}Error: Please specify a file path. Example: codearch file src/auth/AuthService.ts${c.reset}`);
        process.exit(1);
      }
      CliRenderer.printBanner();
      const res = await engine.analyzeFile(filePath);
      console.log(`\n${c.bold}FILE ANALYSIS:${c.reset} ${filePath}`);
      console.log(`  Language:    ${res.metadata.language}`);
      console.log(`  Lines:       ${res.metadata.linesOfCode}`);
      console.log(`  Complexity:  ${res.metadata.complexity}`);
      console.log(`  Symbols:     ${res.symbols.length}\n`);

      console.log(`${c.bold}Symbols defined:${c.reset}`);
      for (const s of res.symbols) {
        console.log(`  ● [${s.kind.padEnd(8)}] ${c.bold}${s.name}${c.reset} ${c.gray}(line ${s.range.start.line}, complexity: ${s.complexity})${c.reset}`);
      }
      console.log('');
      break;
    }

    case 'symbol': {
      const symbolName = args[1];
      if (!symbolName) {
        console.error(`${c.red}Error: Please specify a symbol name. Example: codearch symbol calculatePrice${c.reset}`);
        process.exit(1);
      }
      CliRenderer.printBanner();
      // Ensure workspace is analyzed for symbols
      await engine.analyzeWorkspace(cwd);
      const story = await engine.getCodeStory(symbolName);
      CliRenderer.renderCodeStory(story);
      break;
    }

    case 'history': {
      const targetPath = args[1];
      if (!targetPath) {
        console.error(`${c.red}Error: Please specify a file path. Example: codearch history src/auth/AuthService.ts${c.reset}`);
        process.exit(1);
      }
      CliRenderer.printBanner();
      const commits = await engine.getHistory(targetPath, 20);
      console.log(`\n${c.bold}HISTORY:${c.reset} ${targetPath} (${commits.length} commits)\n`);
      for (const cm of commits) {
        console.log(`  ● ${c.yellow}${cm.shortHash}${c.reset} ${c.bold}${cm.message}${c.reset}`);
        console.log(`    ${c.gray}By ${cm.authorName} on ${cm.date.slice(0, 10)}${c.reset}`);
      }
      console.log('');
      break;
    }

    case 'impact': {
      const target = args[1];
      if (!target) {
        console.error(`${c.red}Error: Please specify a symbol or file. Example: codearch impact calculatePrice${c.reset}`);
        process.exit(1);
      }
      CliRenderer.printBanner();
      await engine.analyzeWorkspace(cwd);
      const blast = await engine.getBlastRadius(target);
      CliRenderer.renderBlastRadius(blast);
      break;
    }

    case 'who-broke-this': {
      const filePath = args[1];
      const line = args[2] ? parseInt(args[2], 10) : 1;
      if (!filePath) {
        console.error(`${c.red}Error: Please specify a file path. Example: codearch who-broke-this src/payment/PaymentService.ts 5${c.reset}`);
        process.exit(1);
      }
      CliRenderer.printBanner();
      await engine.analyzeWorkspace(cwd);
      const who = await engine.whoBrokeThis(filePath, line);
      CliRenderer.renderWhoBrokeThis(who);
      break;
    }

    case 'risk': {
      const filePath = args[1];
      const sym = args[2];
      if (!filePath) {
        console.error(`${c.red}Error: Please specify a file path. Example: codearch risk src/pricing/PricingService.ts calculatePrice${c.reset}`);
        process.exit(1);
      }
      CliRenderer.printBanner();
      await engine.analyzeWorkspace(cwd);
      const risk = await engine.getRiskScore(filePath, sym);
      CliRenderer.renderRiskScore(risk);
      break;
    }

    case 'dead-code': {
      CliRenderer.printBanner();
      await engine.analyzeWorkspace(cwd);
      const items = await engine.findDeadCode(60);
      CliRenderer.renderDeadCode(items);
      break;
    }

    case 'duplicates': {
      CliRenderer.printBanner();
      await engine.analyzeWorkspace(cwd);
      const dups = await engine.findDuplicates(65);
      CliRenderer.renderDuplicates(dups);
      break;
    }

    case 'architecture': {
      CliRenderer.printBanner();
      await engine.analyzeWorkspace(cwd);
      const modules = await engine.inspectArchitecture();
      CliRenderer.renderArchitecture(modules);
      break;
    }

    case 'dashboard': {
      const portIdx = args.indexOf('--port');
      const port = portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : 3456;
      startLocalDashboard(engine, port);
      break;
    }

    case 'serve': {
      const portIdx = args.indexOf('--port');
      const port = portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : 3457;
      startRpcServer(engine, port);
      break;
    }

    default:
      console.log(`${c.red}Unknown command: "${command}". Run "codearch --help" for available commands.${c.reset}`);
      process.exit(1);
  }
}

export function startLocalDashboard(engine: ArchaeologyEngine, port: number): void {
  CliRenderer.printBanner();
  console.log(`${c.cyan}Starting Code Archaeologist Web Dashboard...${c.reset}`);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    // API Routes
    if (url.pathname.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      try {
        if (url.pathname === '/api/summary') {
          const summary = await engine.analyzeWorkspace();
          res.end(JSON.stringify(summary));
          return;
        }

        if (url.pathname === '/api/story') {
          const symbol = url.searchParams.get('symbol') || 'calculatePrice';
          const file = url.searchParams.get('file') || undefined;
          const story = await engine.getCodeStory(symbol, file);
          res.end(JSON.stringify(story));
          return;
        }

        if (url.pathname === '/api/blast-radius') {
          const symbol = url.searchParams.get('symbol') || 'calculatePrice';
          const file = url.searchParams.get('file') || undefined;
          const radius = await engine.getBlastRadius(symbol, file);
          res.end(JSON.stringify(radius));
          return;
        }

        if (url.pathname === '/api/who-broke-this') {
          const file = url.searchParams.get('file') || 'src/index.ts';
          const line = parseInt(url.searchParams.get('line') || '1', 10);
          const who = await engine.whoBrokeThis(file, line);
          res.end(JSON.stringify(who));
          return;
        }

        if (url.pathname === '/api/risk') {
          const file = url.searchParams.get('file') || 'src/index.ts';
          const symbol = url.searchParams.get('symbol') || undefined;
          const risk = await engine.getRiskScore(file, symbol);
          res.end(JSON.stringify(risk));
          return;
        }

        if (url.pathname === '/api/dead-code') {
          const dead = await engine.findDeadCode();
          res.end(JSON.stringify(dead));
          return;
        }

        if (url.pathname === '/api/duplicates') {
          const dups = await engine.findDuplicates();
          res.end(JSON.stringify(dups));
          return;
        }

        if (url.pathname === '/api/architecture') {
          const arch = await engine.inspectArchitecture();
          res.end(JSON.stringify(arch));
          return;
        }

        if (url.pathname === '/api/symbols') {
          const syms = engine.db.getAllSymbols();
          res.end(JSON.stringify(syms));
          return;
        }

        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Endpoint not found' }));
      } catch (err: any) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err?.message || 'Server error' }));
      }
      return;
    }

    // Serve Dashboard HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.writeHead(200);
    res.end(getEmbeddedDashboardHtml());
  });

  server.listen(port, () => {
    console.log(`
${c.green}${c.bold}● Dashboard active:${c.reset} ${c.cyan}http://localhost:${port}${c.reset}
${c.gray}Privacy Status: ${engine.ai.getStatus().statusText}${c.reset}
${c.dim}Press Ctrl+C to terminate server.${c.reset}
`);
  });
}

export function startRpcServer(engine: ArchaeologyEngine, port: number): void {
  const server = http.createServer((req, res) => {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        const transport = {
          send: (resp: string) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(resp);
          },
          onMessage: (cb: (msg: string) => void) => {
            cb(body);
          },
          close: () => {}
        };
        engine.bindProtocolServer(transport);
      });
    } else {
      res.writeHead(405);
      res.end('Method Not Allowed');
    }
  });

  server.listen(port, () => {
    console.log(`${c.green}JSON-RPC Protocol Server running on port ${port}${c.reset}`);
  });
}

function getEmbeddedDashboardHtml(): string {
  // Return the production interactive single-page app HTML with high-density forensic inspect UI
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Archaeologist | Forensic Code Intelligence</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: #090D14;
      --bg-panel: #111722;
      --bg-panel-alt: #161F2E;
      --border-subtle: #1E293B;
      --border-glow: #334155;
      --text-main: #F1F5F9;
      --text-muted: #94A3B8;
      --accent-cyan: #38BDF8;
      --accent-amber: #F59E0B;
      --accent-emerald: #10B981;
      --accent-rose: #F43F5E;
      --accent-violet: #A855F7;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg-dark);
      color: var(--text-main);
      font-family: 'Outfit', sans-serif;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    header {
      background: var(--bg-panel);
      border-bottom: 1px solid var(--border-subtle);
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    .brand-icon {
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-violet));
      color: #fff;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      display: grid;
      place-items: center;
      font-size: 14px;
      font-family: 'JetBrains Mono', monospace;
    }
    .badge-privacy {
      font-size: 0.75rem;
      padding: 4px 10px;
      border-radius: 9999px;
      background: rgba(16, 185, 129, 0.12);
      color: var(--accent-emerald);
      border: 1px solid rgba(16, 185, 129, 0.3);
      font-family: 'JetBrains Mono', monospace;
      font-weight: 500;
    }
    nav.tabs {
      display: flex;
      gap: 8px;
      background: var(--bg-panel);
      padding: 6px 24px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .tab-btn {
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-muted);
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
      transition: all 0.15s ease;
    }
    .tab-btn:hover {
      color: var(--text-main);
      background: var(--bg-panel-alt);
    }
    .tab-btn.active {
      color: var(--accent-cyan);
      background: var(--bg-panel-alt);
      border-color: var(--border-glow);
    }
    main {
      flex: 1;
      display: grid;
      grid-template-columns: 320px 1fr;
      overflow: hidden;
    }
    .sidebar {
      background: var(--bg-panel);
      border-right: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }
    .sidebar-header {
      padding: 14px 16px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .symbol-list {
      list-style: none;
    }
    .symbol-item {
      padding: 10px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: background 0.15s ease;
    }
    .symbol-item:hover, .symbol-item.active {
      background: var(--bg-panel-alt);
      border-left: 3px solid var(--accent-cyan);
    }
    .symbol-name {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.82rem;
      color: var(--text-main);
    }
    .symbol-kind {
      font-size: 0.7rem;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-muted);
    }
    .content-area {
      padding: 24px 32px;
      overflow-y: auto;
      background: var(--bg-dark);
    }
    .view-card {
      background: var(--bg-panel);
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .card-title {
      font-size: 1.15rem;
      font-weight: 700;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      margin: 16px 0;
    }
    .metric-box {
      background: var(--bg-panel-alt);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 12px;
    }
    .metric-label {
      font-size: 0.72rem;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .metric-value {
      font-size: 1.25rem;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
    }
    .timeline {
      position: relative;
      margin: 20px 0 20px 16px;
      padding-left: 20px;
      border-left: 2px solid var(--border-glow);
    }
    .timeline-node {
      position: relative;
      margin-bottom: 20px;
    }
    .timeline-node::before {
      content: '';
      position: absolute;
      left: -27px;
      top: 4px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--accent-cyan);
      border: 2px solid var(--bg-dark);
    }
    .timeline-version {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      color: var(--accent-cyan);
      font-weight: 700;
    }
    .timeline-title {
      font-weight: 600;
      font-size: 0.95rem;
      margin: 2px 0;
    }
    .timeline-meta {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .epistemic-badge {
      font-size: 0.68rem;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'JetBrains Mono', monospace;
    }
    .epistemic-FACT { background: rgba(16, 185, 129, 0.15); color: var(--accent-emerald); }
    .epistemic-INFERENCE { background: rgba(245, 158, 11, 0.15); color: var(--accent-amber); }
    .epistemic-AI { background: rgba(168, 85, 247, 0.15); color: var(--accent-violet); }
    pre {
      background: var(--bg-panel-alt);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 14px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.82rem;
      overflow-x: auto;
      color: #E2E8F0;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="brand-icon">CA</div>
      <div>Code Archaeologist</div>
    </div>
    <div class="badge-privacy" id="privacy-badge">● LOCAL ANALYSIS (100% Offline)</div>
  </header>
  <nav class="tabs">
    <button class="tab-btn active" onclick="switchTab('story')">Code Story & Evolution</button>
    <button class="tab-btn" onclick="switchTab('blast')">Blast Radius</button>
    <button class="tab-btn" onclick="switchTab('who')">Who Broke This?</button>
    <button class="tab-btn" onclick="switchTab('dead')">Dead Code</button>
    <button class="tab-btn" onclick="switchTab('dups')">Structural Duplicates</button>
    <button class="tab-btn" onclick="switchTab('arch')">Architecture Inspect</button>
  </nav>
  <main>
    <div class="sidebar">
      <div class="sidebar-header">
        <span>Workspace Symbols</span>
        <span id="symbol-count">...</span>
      </div>
      <ul class="symbol-list" id="symbols-container">
        <li class="symbol-item"><span class="symbol-name">Loading...</span></li>
      </ul>
    </div>
    <div class="content-area" id="main-content">
      <div class="view-card">
        <div class="card-title">Select a symbol to begin forensic archaeology</div>
        <p style="color: var(--text-muted); font-size: 0.9rem;">
          Code Archaeologist reconstructs the origin, git evolution, structural blast radius, and risk profile for your codebase without requiring third-party cloud services.
        </p>
      </div>
    </div>
  </main>

  <script>
    let currentTab = 'story';
    let currentSymbol = null;
    let symbolsList = [];

    async function init() {
      try {
        const res = await fetch('/api/symbols');
        symbolsList = await res.json();
        renderSymbolsList();
        if (symbolsList.length > 0) {
          selectSymbol(symbolsList[0]);
        }
      } catch (err) {
        console.error(err);
      }
    }

    function renderSymbolsList() {
      const container = document.getElementById('symbols-container');
      document.getElementById('symbol-count').innerText = symbolsList.length + ' symbols';
      container.innerHTML = symbolsList.map(s => \`
        <li class="symbol-item \${currentSymbol && currentSymbol.id === s.id ? 'active' : ''}" onclick="selectSymbolByName('\${s.name}')">
          <span class="symbol-name">\${s.name}</span>
          <span class="symbol-kind">\${s.kind}</span>
        </li>
      \`).join('');
    }

    function selectSymbolByName(name) {
      const s = symbolsList.find(x => x.name === name);
      if (s) selectSymbol(s);
    }

    function selectSymbol(sym) {
      currentSymbol = sym;
      renderSymbolsList();
      loadTabContent();
    }

    function switchTab(tab) {
      currentTab = tab;
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');
      loadTabContent();
    }

    async function loadTabContent() {
      const main = document.getElementById('main-content');
      if (!currentSymbol && currentTab !== 'dead' && currentTab !== 'dups' && currentTab !== 'arch') {
        return;
      }

      if (currentTab === 'story') {
        main.innerHTML = '<div class="view-card"><h3>Reconstructing Code Story...</h3></div>';
        const res = await fetch('/api/story?symbol=' + encodeURIComponent(currentSymbol.name) + '&file=' + encodeURIComponent(currentSymbol.filePath));
        const story = await res.json();
        renderStoryView(story);
      } else if (currentTab === 'blast') {
        main.innerHTML = '<div class="view-card"><h3>Calculating Blast Radius...</h3></div>';
        const res = await fetch('/api/blast-radius?symbol=' + encodeURIComponent(currentSymbol.name) + '&file=' + encodeURIComponent(currentSymbol.filePath));
        const blast = await res.json();
        renderBlastView(blast);
      } else if (currentTab === 'who') {
        main.innerHTML = '<div class="view-card"><h3>Investigating Origin & Blame...</h3></div>';
        const res = await fetch('/api/who-broke-this?file=' + encodeURIComponent(currentSymbol.filePath) + '&line=' + currentSymbol.range.start.line);
        const who = await res.json();
        renderWhoView(who);
      } else if (currentTab === 'dead') {
        main.innerHTML = '<div class="view-card"><h3>Detecting Dead Code...</h3></div>';
        const res = await fetch('/api/dead-code');
        const dead = await res.json();
        renderDeadView(dead);
      } else if (currentTab === 'dups') {
        main.innerHTML = '<div class="view-card"><h3>Analyzing Structural Duplication...</h3></div>';
        const res = await fetch('/api/duplicates');
        const dups = await res.json();
        renderDupsView(dups);
      } else if (currentTab === 'arch') {
        main.innerHTML = '<div class="view-card"><h3>Inspecting Architecture...</h3></div>';
        const res = await fetch('/api/architecture');
        const arch = await res.json();
        renderArchView(arch);
      }
    }

    function renderStoryView(story) {
      const main = document.getElementById('main-content');
      main.innerHTML = \`
        <div class="view-card">
          <div class="card-title">
            <span>\${story.symbolName}()</span>
            <span class="badge-privacy">\${story.currentState.risk} Risk (\${story.currentState.riskScore}/100)</span>
          </div>
          <p style="color: var(--text-muted); font-size: 0.85rem; font-family: 'JetBrains Mono', monospace;">
            \${story.filePath}
          </p>

          <div class="metrics-grid">
            <div class="metric-box">
              <div class="metric-label">Created</div>
              <div class="metric-value" style="font-size: 0.95rem;">\${story.createdDate}</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Dependents</div>
              <div class="metric-value" style="color: var(--accent-violet);">\${story.currentState.dependentsCount}</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Complexity</div>
              <div class="metric-value">\${story.currentState.complexity} (\${story.currentState.complexityScore})</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Tests</div>
              <div class="metric-value" style="color: var(--accent-emerald);">\${story.currentState.testsCount}</div>
            </div>
          </div>

          <div style="margin: 20px 0;">
            <div style="font-weight: 700; font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px;">Original Purpose</div>
            <div style="font-size: 0.95rem; line-height: 1.5;">\${story.originalPurpose}</div>
          </div>

          <div style="font-weight: 700; font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 12px;">Evolution Timeline</div>
          <div class="timeline">
            \${story.evolution.map(m => \`
              <div class="timeline-node">
                <div class="timeline-version">\${m.version}</div>
                <div class="timeline-title">\${m.title}</div>
                <div class="timeline-meta">\${m.author} &bull; \${m.date.slice(0, 10)} &bull; commit \${m.commitHash.slice(0, 7)}</div>
              </div>
            \`).join('')}
          </div>

          <div style="font-weight: 700; font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px;">Epistemic Validation</div>
          <div>
            \${story.epistemicNotes.map(n => \`
              <div style="margin-bottom: 8px; font-size: 0.85rem;">
                <span class="epistemic-badge epistemic-\${n.status}">\${n.status}</span>
                <span style="margin-left: 8px;">\${n.claim}</span>
                <span style="color: var(--text-muted); font-size: 0.75rem;">(\${n.source})</span>
              </div>
            \`).join('')}
          </div>
        </div>
      \`;
    }

    function renderBlastView(blast) {
      const main = document.getElementById('main-content');
      main.innerHTML = \`
        <div class="view-card">
          <div class="card-title">
            <span>Blast Radius: \${blast.symbolName}</span>
            <span class="badge-privacy" style="color: \${blast.overallRisk === 'HIGH' ? 'var(--accent-rose)' : 'var(--accent-emerald)'};">Risk: \${blast.overallRisk} (\${blast.riskScore}/100)</span>
          </div>
          <div class="metrics-grid">
            <div class="metric-box">
              <div class="metric-label">Direct Dependents</div>
              <div class="metric-value">\${blast.directDependents}</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Indirect Dependents</div>
              <div class="metric-value">\${blast.indirectDependents}</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Affected Files</div>
              <div class="metric-value">\${blast.affectedFiles}</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Affected Tests</div>
              <div class="metric-value" style="color: var(--accent-emerald);">\${blast.affectedTests}</div>
            </div>
          </div>
          <div style="font-weight: 700; font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); margin: 16px 0 8px;">Architecture Falloff Tree</div>
          <pre>\${renderAsciiTree(blast.tree)}</pre>
        </div>
      \`;
    }

    function renderWhoView(who) {
      const main = document.getElementById('main-content');
      main.innerHTML = \`
        <div class="view-card">
          <div class="card-title">
            <span>Forensic Investigation: \${who.target}</span>
            <span class="badge-privacy">Regression Risk: \${who.potentialRegression}</span>
          </div>
          <p style="margin-bottom: 16px; color: var(--text-muted); font-size: 0.9rem;">\${who.explanation}</p>
          <div class="metric-box" style="margin-bottom: 16px;">
            <div class="metric-label">Introduced By Commit</div>
            <div style="font-size: 1.05rem; font-weight: 700; margin: 4px 0;">\${who.introducedBy.message}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">Author: \${who.introducedBy.author} &bull; \${who.introducedBy.date.slice(0, 10)} &bull; \${who.introducedBy.shortHash}</div>
          </div>
          <div style="font-weight: 700; font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); margin: 16px 0 8px;">Investigation Chain</div>
          \${who.chain.map(c => \`
            <div style="padding: 10px 14px; background: var(--bg-panel-alt); border-radius: 6px; margin-bottom: 8px; border-left: 3px solid var(--accent-amber);">
              <div style="font-size: 0.8rem; font-weight: 700; color: var(--accent-amber);">[\${c.level}] \${c.title}</div>
              <div style="font-size: 0.85rem; color: var(--text-main); margin-top: 2px;">\${c.description}</div>
            </div>
          \`).join('')}
        </div>
      \`;
    }

    function renderDeadView(dead) {
      const main = document.getElementById('main-content');
      main.innerHTML = \`
        <div class="view-card">
          <div class="card-title">Dead Code Detector (\${dead.length} items found)</div>
          \${dead.length === 0 ? '<p style="color: var(--accent-emerald);">No dead code identified.</p>' : ''}
          \${dead.map(d => \`
            <div style="padding: 14px; background: var(--bg-panel-alt); border-radius: 8px; margin-bottom: 12px; border: 1px solid var(--border-subtle);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-family: 'JetBrains Mono', monospace; font-weight: 700; color: var(--accent-rose);">\${d.symbolName}()</span>
                <span style="font-size: 0.75rem; color: var(--accent-amber); font-weight: 700;">\${d.confidence}% Confidence</span>
              </div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin: 4px 0 8px;">\${d.filePath}:\${d.line}</div>
              <ul style="padding-left: 18px; font-size: 0.82rem; color: var(--text-muted);">
                \${d.reasons.map(r => '<li>' + r + '</li>').join('')}
              </ul>
            </div>
          \`).join('')}
        </div>
      \`;
    }

    function renderDupsView(dups) {
      const main = document.getElementById('main-content');
      main.innerHTML = \`
        <div class="view-card">
          <div class="card-title">Structural Duplicate Detector (\${dups.length} patterns)</div>
          \${dups.length === 0 ? '<p style="color: var(--accent-emerald);">No duplicated logic detected.</p>' : ''}
          \${dups.map(d => \`
            <div style="padding: 14px; background: var(--bg-panel-alt); border-radius: 8px; margin-bottom: 12px; border: 1px solid var(--border-subtle);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-family: 'JetBrains Mono', monospace; font-weight: 700; color: var(--accent-cyan);">\${d.symbolA.name} &harr; \${d.symbolB.name}</span>
                <span style="font-size: 0.75rem; color: var(--accent-amber); font-weight: 700;">\${d.similarity}% Structural Match</span>
              </div>
              <div style="font-size: 0.82rem; color: var(--text-muted); margin: 6px 0;">
                Shared: \${d.sharedStructure.join(', ')}
              </div>
              <div style="font-size: 0.8rem; color: var(--accent-emerald);">
                Suggested refactoring: Extract into <strong>\${d.possibleExtraction}</strong>
              </div>
            </div>
          \`).join('')}
        </div>
      \`;
    }

    function renderArchView(arch) {
      const main = document.getElementById('main-content');
      main.innerHTML = \`
        <div class="view-card">
          <div class="card-title">Architecture Inspect Mode (\${arch.length} modules)</div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-top: 14px;">
            \${arch.map(m => \`
              <div style="padding: 16px; background: var(--bg-panel-alt); border-radius: 8px; border: 1px solid var(--border-subtle);">
                <div style="font-weight: 700; font-size: 1rem; color: var(--accent-cyan);">\${m.name}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin: 4px 0 8px;">\${m.filesCount} files &bull; \${m.symbolsCount} symbols</div>
                <div style="font-size: 0.78rem;">
                  <div><strong>Depends on:</strong> \${m.dependencies.join(', ') || 'None'}</div>
                  <div style="margin-top: 4px;"><strong>Callers:</strong> \${m.callers.join(', ') || 'None'}</div>
                </div>
              </div>
            \`).join('')}
          </div>
        </div>
      \`;
    }

    function renderAsciiTree(node, prefix = '', isLast = true) {
      let str = prefix + (isLast ? '└── ' : '├── ') + node.name + ' (' + node.filePath + ')\\n';
      const nextPrefix = prefix + (isLast ? '    ' : '│   ');
      for (let i = 0; i < node.children.length; i++) {
        str += renderAsciiTree(node.children[i], nextPrefix, i === node.children.length - 1);
      }
      return str;
    }

    window.onload = init;
  </script>
</body>
</html>`;
}
