#!/usr/bin/env node
/**
 * Use Case 2: Indie Game Developer
 *
 * Testing a simple game for playability and visual polish.
 *
 * Demonstrates:
 * - playGame() for AI-driven gameplay
 * - validateWithGoals() for goal-based evaluation
 * - testGameplay() for complete workflow
 *
 * Run: node examples/use-case-2-indie-game-dev.mjs
 * Requires: GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY
 */

import { playGame, testGameplay, validateWithGoals } from '@arclabs561/ai-visual-test/game';

async function testGame() {
  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.GROQ_API_KEY) {
    console.log('No API keys configured.');
    console.log('Set GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY in .env');
    process.exit(1);
  }

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: false }); // show browser for game
  const page = await browser.newPage();

  try {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Simple Game</title>
        <style>
          body { margin: 0; padding: 0; background: #000; color: #fff; font-family: Arial; }
          #game { width: 800px; height: 600px; margin: 20px auto; position: relative; border: 2px solid #fff; }
          #paddle { position: absolute; bottom: 10px; left: 350px; width: 100px; height: 20px; background: #fff; }
          #ball { position: absolute; top: 50%; left: 50%; width: 20px; height: 20px; background: #fff; border-radius: 50%; }
          #score { position: absolute; top: 10px; left: 10px; font-size: 24px; }
          .instructions { text-align: center; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="instructions">
          <h1>Simple Game</h1>
          <p>Use Arrow Left/Right to move paddle. Press 'g' to start game.</p>
        </div>
        <div id="game">
          <div id="score">Score: 0</div>
          <div id="paddle"></div>
          <div id="ball"></div>
        </div>
        <script>
          let gameActive = false;
          let score = 0;
          let paddleX = 350;
          let ballX = 400;
          let ballY = 300;
          let ballVX = 2;
          let ballVY = -2;

          window.gameState = { gameActive: false, score: 0, level: 1, lives: 3 };

          const paddle = document.getElementById('paddle');
          const ball = document.getElementById('ball');
          const scoreEl = document.getElementById('score');

          function updateGame() {
            if (!gameActive) return;

            ballX += ballVX;
            ballY += ballVY;

            if (ballX < 0 || ballX > 780) ballVX = -ballVX;
            if (ballY < 0) ballVY = -ballVY;
            if (ballY > 580) {
              ballY = 300;
              ballX = 400;
              score = Math.max(0, score - 1);
            }

            if (ballY > 560 && ballX > paddleX && ballX < paddleX + 100) {
              ballVY = -ballVY;
              score++;
            }

            ball.style.left = ballX + 'px';
            ball.style.top = ballY + 'px';
            scoreEl.textContent = 'Score: ' + score;
            window.gameState = {
              gameActive: true,
              score: score,
              level: Math.floor(score / 10) + 1,
              lives: 3,
              ballX: ballX,
              ballY: ballY,
              paddleX: paddleX
            };

            requestAnimationFrame(updateGame);
          }

          document.addEventListener('keydown', (e) => {
            if (e.key === 'g' || e.key === 'G') {
              gameActive = true;
              window.gameState.gameActive = true;
              updateGame();
            }
            if (e.key === 'ArrowLeft') paddleX = Math.max(0, paddleX - 20);
            if (e.key === 'ArrowRight') paddleX = Math.min(700, paddleX + 20);
            paddle.style.left = paddleX + 'px';
          });
        </script>
      </body>
      </html>
    `;

    await page.setContent(html);
    await page.waitForLoadState('networkidle');

    // 1. Play the game with AI
    console.log('AI Gameplay Test');
    console.log('  (takes ~30 seconds as AI plays the game)');

    const playResult = await playGame(page, {
      goal: 'Maximize score by hitting the ball with the paddle',
      maxSteps: 20,
      fps: 2,
      gameActivationKey: 'g',
      gameSelector: '#paddle'
    });

    console.log(`  Final Score: ${playResult.finalScore || 0}`);
    console.log(`  Steps Taken: ${playResult.steps?.length || 0}`);
    console.log(`  Average Score: ${playResult.averageScore || 0}`);
    console.log();

    // 2. Goal-based evaluation
    console.log('Goal-Based Evaluation');
    const path = await import('path');
    const os = await import('os');
    const screenshotPath = path.join(os.tmpdir(), `game-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath });

    const funResult = await validateWithGoals(screenshotPath, {
      goal: 'Is this game fun and engaging? Rate the visual appeal and playability.',
      gameState: await page.evaluate(() => window.gameState || {})
    });

    console.log(`  Fun Score: ${funResult.result.score}/10`);
    console.log(`  Reasoning: ${funResult.result.reasoning?.substring(0, 100)}...`);
    console.log();

    // 3. Complete gameplay test workflow
    console.log('Complete Gameplay Test');
    const gameplayResult = await testGameplay(page, {
      url: 'about:blank',
      goals: ['fun', 'visual polish', 'playability'],
      captureTemporal: true,
      fps: 2,
      duration: 3000,
      play: false
    });

    console.log(`  Evaluations: ${gameplayResult.evaluations?.length || 0}`);
    if (gameplayResult.evaluations?.length > 0) {
      gameplayResult.evaluations.forEach((evaluation, i) => {
        console.log(`  ${i + 1}. ${evaluation.goal}: ${evaluation.evaluation.score}/10`);
      });
    }
    console.log();

    console.log('Done.');
    console.log(`  Game is ${playResult.finalScore > 0 ? 'playable' : 'needs work'}`);

  } catch (error) {
    console.error('Error:', error.message);
    if (error.details) {
      console.error('  Details:', error.details);
    }
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testGame().catch(console.error);
