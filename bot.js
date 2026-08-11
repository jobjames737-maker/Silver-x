const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Presence,
  downloadMediaMessage,
  downloadContentFromMessage,
  fetchLatestBaileysVersion,
  Browsers,
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const youtubedl = require('youtube-dl-exec');
const cron = require("node-cron");

const logger = pino({
  level: "info",
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  }
});

const adminSettings = {};
const stickerCommands = {};
const lockedGroups = new Set();
const userWarns = {};
let BOT_OWNER = null; // Will be auto-detected from pairing
const sudoUsers = []; // Users who can use the bot like owner
let nightModeGroups = [];
let nightCronStarted = false;
let currentSock = null;
let botMode = "private";
let PREFIX = ".";

// Bot start time for uptime tracking
const botStartTime = Date.now();

// Anonymous messaging system
const ANONYMOUS_WEB_URL = "https://lucaanonym.vercel.app"; // Deployed Vercel URL
const anonymousSessions = new Map();
const axios = require('axios');
const yts = require('yt-search');

// RTW Game System
const rtwGames = new Map(); // Store active games by group JID
const WORDS_FILE = path.join(__dirname, 'words.txt');

// WCG (Word Chain Game) System
const wcgGames = new Map(); // Store active WCG games by group JID
const wcgStats = {}; // Store WCG stats per group

// 400Q Game System (DM only)
const q400Games = new Map(); // Store active 400Q sessions by chat JID
const QUESTIONS_FILE = path.join(__dirname, 'questions_400.txt');

// Custom welcome messages per group
const customWelcomeMessages = {};

// Custom goodbye messages per group
const customGoodbyeMessages = {};

// Welcome/Goodbye enabled per group (disabled by default)
const welcomeEnabled = {}; // { groupJid: true/false }
const goodbyeEnabled = {}; // { groupJid: true/false }

// AFK System
const afkUsers = {}; // { jid: { reason, time } }

const groupActivity = {}; // { groupId: { userId: { count, lastMessage } } }

const activityTracking = {}; // { groupId: true }
const pendingKickInactive = {};

// ============================================
// EXP / LEVEL SYSTEM
// ============================================

// EXP enabled per group — disabled by default
const expEnabled = {}; // { groupJid: true }

// User EXP data per group
// { groupJid: { userJid: { xp, level } } }
const userExp = {};

// EXP cooldowns — prevents message spam from farming XP
const expCooldowns = new Map();

// EXP settings
const EXP_MIN = 5;
const EXP_MAX = 15;
const EXP_COOLDOWN = 60 * 1000; // 60 seconds
// Anti-mention Settings (for groups)
const antiMentionGroups = {}; // { groupJid: true/false }

// Anti-Photo Settings (for groups) - { groupJid: 'kick'|'warn'|false }
const antiPhotoGroups = {};

// Anti-Status Settings (for groups) - { groupJid: 'kick'|'warn'|false }
const antiStatusGroups = {};

// Anti-Tag Settings (for groups) - { groupJid: 'kick'|'warn'|false }
const antiTagGroups = {};

// Anti-Spam Settings (for groups) - { groupJid: 'kick'|'warn'|false }
const antiSpamGroups = {};
const spamTracker = new Map(); // { 'groupJid:senderJid': { count, firstMsgTime, lastWarnTime } }
const SPAM_THRESHOLD = 8; // messages within time window
const SPAM_WINDOW = 5000; // 5 seconds

// Anti-Delete System
let antiDeleteEnabled = false; // Global toggle for anti-delete
const messageCache = new Map(); // Cache messages for anti-delete { messageId: messageData }
const MAX_CACHE_SIZE = 1000; // Maximum messages to cache
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes expiry

// Data file path
const DATA_FILE = path.join(__dirname, 'bot_data.json');

// Load data from JSON file
const loadData = () => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

      // Load bot owner
      if (data.botOwner) {
        BOT_OWNER = data.botOwner;
        logger.info({ owner: BOT_OWNER }, 'Bot owner loaded from saved data');
      }

      // Load bot prefix
if (data.prefix) {
  PREFIX = data.prefix;
  logger.info({ prefix: PREFIX }, "Bot prefix loaded from saved data");
}
      // Load custom welcome messages
      if (data.customWelcomeMessages) {
        Object.assign(customWelcomeMessages, data.customWelcomeMessages);
      }
      if (data.customGoodbyeMessages) {
        Object.assign(customGoodbyeMessages, data.customGoodbyeMessages);
      }

      // Load welcome/goodbye enabled settings
      if (data.welcomeEnabled) {
        Object.assign(welcomeEnabled, data.welcomeEnabled);
      }
      if (data.goodbyeEnabled) {
        Object.assign(goodbyeEnabled, data.goodbyeEnabled);
      }

      // Load sticker commands
      if (data.stickerCommands) {
        Object.assign(stickerCommands, data.stickerCommands);
      }

      // Load admin settings
      if (data.adminSettings) {
        Object.assign(adminSettings, data.adminSettings);
      }

      // Load user warns
      if (data.userWarns) {
        Object.assign(userWarns, data.userWarns);
      }

      // Load sudo users
      if (data.sudoUsers && Array.isArray(data.sudoUsers)) {
        sudoUsers.length = 0;
        sudoUsers.push(...data.sudoUsers);
      }
      // Load Night Mode groups
if (data.nightModeGroups && Array.isArray(data.nightModeGroups)) {
  nightModeGroups.length = 0;
  nightModeGroups.push(...data.nightModeGroups);
}

      // Load WCG stats
      if (data.wcgStats) {
        Object.assign(wcgStats, data.wcgStats);
      }

      // Load AFK users
      if (data.afkUsers) {
        Object.assign(afkUsers, data.afkUsers);
      }

      // Load anti-mention groups
      if (data.antiMentionGroups) {
        Object.assign(antiMentionGroups, data.antiMentionGroups);
      }

      // Load anti-photo groups
      if (data.antiPhotoGroups) {
        Object.assign(antiPhotoGroups, data.antiPhotoGroups);
      }

      // Load anti-status groups
      if (data.antiStatusGroups) {
        Object.assign(antiStatusGroups, data.antiStatusGroups);
      }

      // Load anti-tag groups
      if (data.antiTagGroups) {
        Object.assign(antiTagGroups, data.antiTagGroups);
      }

      // Load anti-spam groups
      if (data.antiSpamGroups) {
        Object.assign(antiSpamGroups, data.antiSpamGroups);
      }

      // Load anti-delete setting
      if (data.antiDeleteEnabled !== undefined) {
        antiDeleteEnabled = data.antiDeleteEnabled;
      }

      // Load group activity
if (data.groupActivity) {
  Object.assign(groupActivity, data.groupActivity);
}
      if (data.activityTracking) {
  Object.assign(activityTracking, data.activityTracking);
      }

      // Load EXP system data
      if (data.expEnabled) {
        Object.assign(expEnabled, data.expEnabled);
      }

      if (data.userExp) {
        Object.assign(userExp, data.userExp);
      }

      logger.info('Bot data loaded successfully from JSON');
    } else {
      logger.info('No existing data file found, starting fresh');
    }
  } catch (error) {
    logger.error({ error: error.message }, 'Error loading bot data');
  }
};

// Save data to JSON file
const saveData = () => {
  try {
    const data = {
      botOwner: BOT_OWNER,
      prefix: PREFIX,
      customWelcomeMessages,
      customGoodbyeMessages,
      welcomeEnabled,
      goodbyeEnabled,
      stickerCommands,
      adminSettings,
      userWarns,
      sudoUsers,
      nightModeGroups,
      wcgStats,
      afkUsers,
      antiMentionGroups,
      antiPhotoGroups,
      antiStatusGroups,
      antiTagGroups,
      antiSpamGroups,
      antiDeleteEnabled,
      groupActivity,
      activityTracking,
      expEnabled,
      userExp,
      lastSaved: new Date().toISOString()
    };
    
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    logger.debug('Bot data saved to JSON');
  } catch (error) {
    logger.error({ error: error.message }, 'Error saving bot data');
  }
};
// ============================================
// EXP / LEVEL CALCULATION
// ============================================

function getExpRequired(level) {
  return level * 100;
}

function calculateLevel(exp) {
  let level = 1;

  while (exp >= getExpRequired(level)) {
    exp -= getExpRequired(level);
    level++;
  }

  return level;
}

// ============================================
// EXP RANK TITLES
// ============================================
function getExpTitle(level) {
  if (level >= 100) return "☠️ SILVER GOD";
  if (level >= 75) return "🌌 Mythic";
  if (level >= 50) return "🐉 Legend";
  if (level >= 30) return "👑 Veteran";
  if (level >= 20) return "💎 Elite";
  if (level >= 10) return "🔥 Active";
  if (level >= 5) return "⚡ Rising Star";
  return "🌱 Beginner";
}

async function getInactiveMembers(groupMetadata, groupActivityData, myJid, threshold = 50) {
  const inactive = [];

  for (const participant of groupMetadata.participants) {

    // Skip admins
    if (
      participant.admin === "admin" ||
      participant.admin === "superadmin"
    ) continue;

    // Skip bot
    if (normalizeJid(participant.id) === normalizeJid(myJid))
      continue;

    const data = groupActivityData[participant.id] || {
      count: 0,
      lastMessage: null
    };

    if (data.count < threshold) {
      inactive.push({
        jid: participant.id,
        count: data.count,
        lastMessage: data.lastMessage
      });
    }
  }

  inactive.sort((a, b) => a.count - b.count);

  return inactive;
}

// ============================================
// Auto-save data every 5 minutes
setInterval(() => {
  saveData();
}, 5 * 60 * 1000);

const isOwnerNumber = (senderJid) => {
  if (!senderJid || !BOT_OWNER) {
    logger.warn({ senderJid, BOT_OWNER }, 'Owner check FAILED: Missing senderJid or BOT_OWNER');
    return false;
  }

  // Strip JID to just the number, removing any :X suffixes and @lid/@s.whatsapp.net
  let senderNumber = senderJid.split("@")[0];
  senderNumber = senderNumber.split(":")[0]; // Remove :8 or other suffixes

  // Also normalize BOT_OWNER
  let ownerNumber = BOT_OWNER.split("@")[0];
  ownerNumber = ownerNumber.split(":")[0];

  // Check if the sender number matches the owner
  // Also check if sender contains the owner number (for LID format)
  const isOwner = senderNumber === ownerNumber || senderJid.includes(ownerNumber);

  // Verbose logging disabled to reduce console spam
  // logger.info({
  //   senderJid,
  //   senderNumber,
  //   ownerNumber,
  //   BOT_OWNER,
  //   exactMatch: senderNumber === ownerNumber,
  //   includesMatch: senderJid.includes(ownerNumber),
  //   finalResult: isOwner
  // }, 'OWNER CHECK RESULT');

  return isOwner;
};

const isSudoUser = (senderJid) => {
  if (!senderJid) return false;
  
  let senderNumber = senderJid.split("@")[0];
  senderNumber = senderNumber.split(":")[0];
  
  return sudoUsers.some(sudo => {
    let sudoNumber = sudo.split("@")[0];
    sudoNumber = sudoNumber.split(":")[0];
    return senderNumber === sudoNumber || senderJid.includes(sudoNumber);
  });
};

const normalizeJid = (jid) => {
  if (!jid) return jid;
  const number = jid.split("@")[0];
  return `${number}@s.whatsapp.net`;
};

const isLinkMessage = (text) => {
  if (!text) return false;
  const linkPatterns = [
    /https?:\/\/[^\s]+/i,
    /www\.[^\s]+/i,
    /chat\.whatsapp\.com\/[^\s]+/i,
    /wa\.me\/[^\s]+/i,
    /t\.me\/[^\s]+/i,
    /discord\.gg\/[^\s]+/i,
    /bit\.ly\/[^\s]+/i,
    /tinyurl\.com\/[^\s]+/i
  ];
  return linkPatterns.some(pattern => pattern.test(text));
};

const fetchCryptoPrice = async (symbol) => {
  try {
    const upperSymbol = symbol.toUpperCase();
    const lowerSymbol = symbol.toLowerCase();

    // Try DexScreener first (supports any token/pair globally)
    try {
      const dexUrl = `https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(symbol)}`;
      logger.info({ url: dexUrl }, 'Trying DexScreener API');
      const dexRes = await fetch(dexUrl);
      if (dexRes.ok) {
        const dexData = await dexRes.json();
        if (dexData.pairs && dexData.pairs.length > 0) {
          // Pick the pair with the highest liquidity
          const pair = dexData.pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
          const priceUsd = parseFloat(pair.priceUsd || 0);
          const change24h = parseFloat(pair.priceChange?.h24 || 0);
          const vol24h = parseFloat(pair.volume?.h24 || 0);
          const mcap = parseFloat(pair.marketCap || pair.fdv || 0);
          const tokenSymbol = pair.baseToken?.symbol || upperSymbol;
          const tokenName = pair.baseToken?.name || '';
          const chain = pair.chainId || '';
          const dexName = pair.dexId || '';
          const pairUrl = pair.url || '';

          return {
            symbol: tokenSymbol,
            name: tokenName,
            lastPrice: priceUsd,
            priceChangePercent: change24h,
            volume: vol24h,
            marketCap: mcap,
            chain,
            dex: dexName,
            pairUrl,
            source: 'DexScreener'
          };
        }
      }
    } catch (dexErr) {
      logger.warn({ error: dexErr.message }, 'DexScreener API failed');
    }

    // Fallback: CoinGecko for well-known coins
    const symbolMap = {
      'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana',
      'DOGE': 'dogecoin', 'ADA': 'cardano', 'DOT': 'polkadot',
      'XRP': 'ripple', 'BNB': 'binancecoin', 'AVAX': 'avalanche-2',
      'LTC': 'litecoin', 'ATOM': 'cosmos', 'NEAR': 'near',
      'PEPE': 'pepe', 'SHIB': 'shiba-inu', 'TON': 'toncoin',
      'LINK': 'chainlink', 'UNI': 'uniswap', 'ARB': 'arbitrum',
      'OP': 'optimism', 'MATIC': 'matic-network', 'APT': 'aptos'
    };

    const coinId = symbolMap[upperSymbol] || lowerSymbol;

    try {
      const coingeckoUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`;
      logger.info({ url: coingeckoUrl, coinId }, 'Trying CoinGecko API');
      const response = await fetch(coingeckoUrl);
      if (response.ok) {
        const data = await response.json();
        const cryptoData = data[coinId];
        if (cryptoData) {
          return {
            symbol: upperSymbol,
            name: '',
            lastPrice: cryptoData.usd,
            priceChangePercent: cryptoData.usd_24h_change || 0,
            volume: 0,
            marketCap: cryptoData.usd_market_cap || 0,
            source: 'CoinGecko'
          };
        }
      }
    } catch (cgErr) {
      logger.warn({ error: cgErr.message }, 'CoinGecko API failed');
    }

    logger.error({ symbol: upperSymbol }, 'No API returned valid data');
    return null;
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Crypto fetch error');
    return null;
  }
};


const extractViewOnceMedia = async (quoted) => {
  let viewOnceMsg = null;

  if (quoted?.viewOnceMessage) {
    viewOnceMsg = quoted.viewOnceMessage.message || quoted.viewOnceMessage;
  } else if (quoted?.viewOnceMessageV2) {
    viewOnceMsg = quoted.viewOnceMessageV2.message;
  } else if (quoted?.viewOnceMessageV2Extension) {
    viewOnceMsg = quoted.viewOnceMessageV2Extension.message;
  }

  if (!viewOnceMsg && quoted?.imageMessage) {
    viewOnceMsg = { imageMessage: quoted.imageMessage };
  } else if (!viewOnceMsg && quoted?.videoMessage) {
    viewOnceMsg = { videoMessage: quoted.videoMessage };
  }

  return viewOnceMsg;
};

const downloadViewOnceMedia = async (viewOnceMsg) => {
  const imageMsg = viewOnceMsg?.imageMessage;
  const videoMsg = viewOnceMsg?.videoMessage;

  if (!imageMsg && !videoMsg) return null;

  let mediaData = null;
  let mediaType = null;
  let caption = "";

  try {
    if (imageMsg) {
      const stream = await downloadContentFromMessage(imageMsg, 'image');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }
      mediaData = buffer;
      mediaType = "image";
      caption = imageMsg.caption || "";
    } else if (videoMsg) {
      const stream = await downloadContentFromMessage(videoMsg, 'video');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }
      mediaData = buffer;
      mediaType = "video";
      caption = videoMsg.caption || "";
    }
  } catch (error) {
    logger.error({ error: error.message }, 'Download view-once error');
    return null;
  }

  return { mediaData, mediaType, caption };
};

const convertToSticker = async (imageBuffer) => {
  try {
    let stickerBuffer = await sharp(imageBuffer)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .webp({ lossless: true })
      .toBuffer();
    
    return stickerBuffer;
  } catch (err) {
    logger.error({ error: err.message }, 'Sticker conversion error');
    return null;
  }
};

const convertVideoToSticker = async (videoBuffer) => {
  try {
    const { execSync } = require('child_process');
    const tempDir = path.join(__dirname, 'temp');
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempInput = path.join(tempDir, `input_${Date.now()}.mp4`);
    const tempOutput = path.join(tempDir, `output_${Date.now()}.webp`);
    
    // Write video buffer to temp file
    fs.writeFileSync(tempInput, videoBuffer);
    
    // Convert first 5 seconds of video to animated WebP sticker (512x512, 10fps for smaller size)
    const ffmpegCmd = `ffmpeg -i "${tempInput}" -t 5 -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,fps=10" -vcodec libwebp -lossless 0 -compression_level 6 -q:v 50 -loop 0 -preset default -an -vsync 0 "${tempOutput}" -y`;
    
    execSync(ffmpegCmd, { stdio: 'pipe' });
    
    // Read the output file
    let stickerBuffer = fs.readFileSync(tempOutput);
    
    // Clean up temp files
    fs.unlinkSync(tempInput);
    fs.unlinkSync(tempOutput);
    
    return stickerBuffer;
  } catch (err) {
    logger.error({ error: err.message }, 'Video sticker conversion error');
    return null;
  }
};



// Anonymous messaging helper functions
const generateSessionId = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let sessionId = '';
  for (let i = 0; i < 10; i++) {
    sessionId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return sessionId;
};

const createAnonymousSession = async (groupJid) => {
  const sessionId = generateSessionId();
  const createdAt = Date.now();

  try {
    // Create session on web server and get token
    const response = await axios.post(`${ANONYMOUS_WEB_URL}/api/session/create`, {
      sessionId,
      groupJid,
      createdAt
    });

    const { token } = response.data;

    // Store session locally with token
    anonymousSessions.set(sessionId, {
      groupJid,
      active: true,
      createdAt,
      lastActivity: createdAt,
      messageCount: 0,
      token // Store the token for the URL
    });

    logger.info({ sessionId, groupJid }, 'Anonymous session created');
    return { sessionId, token };
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to create anonymous session');
    return null;
  }
};

const endAnonymousSession = async (sessionId) => {
  try {
    // End session on web server
    await axios.post(`${ANONYMOUS_WEB_URL}/api/session/end`, {
      sessionId
    });

    // Remove session locally
    const session = anonymousSessions.get(sessionId);
    if (session) {
      session.active = false;
    }

    logger.info({ sessionId }, 'Anonymous session ended');
    return true;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to end anonymous session');
    return false;
  }
};

// Check for expired anonymous sessions (20 minutes inactivity)
const checkAnonymousSessionExpiry = async (sock) => {
  const TWENTY_MINUTES = 20 * 60 * 1000;
  const now = Date.now();

  for (const [sessionId, session] of anonymousSessions.entries()) {
    if (!session.active) continue;

    const lastActivity = session.lastActivity || session.createdAt;
    if (now - lastActivity > TWENTY_MINUTES) {
      // Session expired due to inactivity
      await endAnonymousSession(sessionId);
      
      await sock.sendMessage(session.groupJid, {
        text: `*ANONYMOUS*\n\nSession expired (20 min)\nTotal messages: ${session.messageCount}`
      });
      
      logger.info({ sessionId }, 'Anonymous session expired due to inactivity');
    }
  }
};

const pollAnonymousMessages = async (sock) => {
  for (const [sessionId, session] of anonymousSessions.entries()) {
    if (!session.active) continue;

    try {
      const response = await axios.get(`${ANONYMOUS_WEB_URL}/api/messages/poll/${sessionId}`);
      
      // Safety Check: block execution if response or messages array is invalid
      if (!response.data || !Array.isArray(response.data.messages)) {
        continue; 
      }

      const { messages } = response.data;

      for (const msg of messages) {
        // Guard check to make sure individual message contents exist
        if (!msg || !msg.message) continue;

        await sock.sendMessage(session.groupJid, {
          text: `┌─────────────────┐\n  *ANON USER #${msg.number || 1}*\n└─────────────────┘\n\n_${msg.message}_\n\n───────────`
        });

        session.messageCount = msg.number || session.messageCount + 1;
        session.lastActivity = Date.now();
      }
    } catch (error) {
      logger.error({ error: error.message, sessionId }, 'Failed to poll anonymous messages');
    }
  }
};

// ============================================
// RTW (Rearrange The Words) Game System
// ============================================

// Load words from file (cached)
let cachedRTWWords = null;
const loadRTWWords = () => {
  if (cachedRTWWords) return cachedRTWWords;
  try {
    if (!fs.existsSync(WORDS_FILE)) {
      logger.error('Words file not found');
      return null;
    }
    cachedRTWWords = fs.readFileSync(WORDS_FILE, 'utf8')
      .split('\n')
      .map(word => word.trim().toUpperCase())
      .filter(word => word.length >= 5 && word.length <= 10 && /^[A-Z]+$/.test(word));
    
    logger.info({ total: cachedRTWWords.length }, 'RTW words loaded');
    return cachedRTWWords;
  } catch (error) {
    logger.error({ error: error.message }, 'Error loading RTW words');
    return null;
  }
};

// Scramble a word
const scrambleWord = (word) => {
  const letters = word.split('');
  // Shuffle multiple times to ensure good scramble
  for (let k = 0; k < 3; k++) {
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
  }
  const scrambled = letters.join('');
  // If scrambled is same as original, try again
  if (scrambled === word && word.length > 2) {
    return scrambleWord(word);
  }
  return scrambled;
};

// Create RTW game
const createRTWGame = (groupJid, ownerJid) => {
  const game = {
    groupJid,
    ownerJid,
    players: new Map(),
    phase: 'JOINING',
    currentWord: null,
    scrambledWord: null,
    round: 0,
    maxRounds: 25,
    joinTimer: null,
    roundTimer: null,
    gameTimer: null, // Max duration safety timer
    roundId: 0, // Unique ID for each round to prevent stale timers
    startTime: Date.now()
  };
  rtwGames.set(groupJid, game);
  return game;
};

// Clean up RTW game timers
const clearRTWTimers = (game) => {
  if (game.joinTimer) {
    clearInterval(game.joinTimer);
    game.joinTimer = null;
  }
  if (game.roundTimer) {
    clearInterval(game.roundTimer);
    game.roundTimer = null;
  }
  if (game.gameTimer) {
    clearTimeout(game.gameTimer);
    game.gameTimer = null;
  }
};

// End RTW game
const endRTWGame = async (sock, groupJid, reason = 'completed') => {
  const game = rtwGames.get(groupJid);
  if (!game) return;

  clearRTWTimers(game);
  game.phase = 'FINISHED';

  const sortedPlayers = Array.from(game.players.entries())
    .sort(([,a], [,b]) => b.score - a.score);

  let text = `*RTW GAME ENDED*\n\n`;

  if (sortedPlayers.length === 0) {
    text += `No players joined\n`;
  } else {
    sortedPlayers.slice(0, 5).forEach(([jid, player], i) => {
      const medal = i === 0 ? '[1st]' : i === 1 ? '[2nd]' : i === 2 ? '[3rd]' : '[4th]';
      text += `${medal} @${jid.split('@')[0]}: ${player.score}pts\n`;
    });
    text += `\nWinner: @${sortedPlayers[0][0].split('@')[0]}\n`;
  }

  text += `Rounds: ${game.round}/${game.maxRounds}\n`;
  text += `Time: ${Math.floor((Date.now() - game.startTime) / 1000)}s`;


  await sock.sendMessage(groupJid, {
    text,
    mentions: sortedPlayers.map(([jid]) => jid)
  });

  rtwGames.delete(groupJid);
  logger.info({ groupJid, reason }, 'RTW game ended');
};

// Start RTW join phase
const startRTWJoinPhase = async (sock, groupJid) => {
  const game = rtwGames.get(groupJid);
  if (!game) return;

  // Safety timer — force end game after max duration
  game.gameTimer = setTimeout(async () => {
    const g = rtwGames.get(groupJid);
    if (g && g.phase !== 'FINISHED') {
      await endRTWGame(sock, groupJid, 'timeout');
      await sock.sendMessage(groupJid, { text: '⏰ RTW game auto-ended (time limit reached).' });
    }
  }, RTW_MAX_DURATION);

  let timeLeft = 60;

  await sock.sendMessage(groupJid, {
    text: `*RTW GAME*\n\nType *Join* to play!\n${timeLeft}s left`
  });

  game.joinTimer = setInterval(async () => {
    try {
      const currentGame = rtwGames.get(groupJid);
      if (!currentGame || currentGame.phase !== 'JOINING') {
        clearInterval(game.joinTimer);
        game.joinTimer = null;
        return;
      }

      timeLeft--;

    if (timeLeft === 30 || timeLeft === 10) {
      await sock.sendMessage(groupJid, {
        text: `⏱️ *${timeLeft}s left to join!* (${currentGame.players.size} joined)`
      });
    }

    if (timeLeft <= 0) {
      clearInterval(game.joinTimer);
      game.joinTimer = null;

      if (currentGame.players.size < 1) {
        await sock.sendMessage(groupJid, {
          text: `❌ *RTW Cancelled*\nNo players joined!`
        });
        rtwGames.delete(groupJid);
        return;
      }

      currentGame.phase = 'PLAYING';
      
      const playerList = Array.from(currentGame.players.keys())
        .map(jid => `@${jid.split('@')[0]}`)
        .join(', ');

      await sock.sendMessage(groupJid, {
        text: `*RTW Starting!*\nPlayers: ${playerList}\n25 rounds | 30s each`,
        mentions: Array.from(currentGame.players.keys())
      });

      setTimeout(() => startRTWRound(sock, groupJid), 2000);
    }
    } catch (err) {
      logger.error({ error: err.message }, 'RTW join phase error');
      clearInterval(game.joinTimer);
      game.joinTimer = null;
    }
  }, 1000);
};

// Start a RTW round
const startRTWRound = async (sock, groupJid) => {
  const game = rtwGames.get(groupJid);
  if (!game || game.phase !== 'PLAYING') return;

  game.round++;
  game.roundId++; // New unique round ID
  const currentRoundId = game.roundId;

  if (game.round > game.maxRounds) {
    await endRTWGame(sock, groupJid, 'completed');
    return;
  }

  const words = loadRTWWords();
  if (!words || words.length === 0) {
    await sock.sendMessage(groupJid, { text: `❌ No words available!` });
    await endRTWGame(sock, groupJid, 'error');
    return;
  }

  // Select word based on difficulty (round number)
  let minLen, maxLen;
  if (game.round <= 10) {
    minLen = 5; maxLen = 6;
  } else if (game.round <= 18) {
    minLen = 6; maxLen = 7;
  } else {
    minLen = 7; maxLen = 10;
  }

  const filteredWords = words.filter(w => w.length >= minLen && w.length <= maxLen);
  if (filteredWords.length === 0) {
    game.currentWord = words[Math.floor(Math.random() * words.length)];
  } else {
    game.currentWord = filteredWords[Math.floor(Math.random() * filteredWords.length)];
  }
  
  game.scrambledWord = scrambleWord(game.currentWord);

  const difficulty = game.round <= 10 ? 'Easy' : game.round <= 18 ? 'Medium' : 'Hard';

  await sock.sendMessage(groupJid, {
    text: `*Round ${game.round}/25* ${difficulty}\n\nUnscramble: *${game.scrambledWord}*\n\n${game.currentWord.length} letters | 30 seconds`
  });

  let timeLeft = 30;
  game.roundTimer = setInterval(async () => {
    try {
      const currentGame = rtwGames.get(groupJid);
      
      // Check if game still exists and this is still the same round
      if (!currentGame || currentGame.phase !== 'PLAYING' || currentGame.roundId !== currentRoundId) {
        clearInterval(game.roundTimer);
        game.roundTimer = null;
        return;
      }

      timeLeft--;

      if (timeLeft === 10) {
        await sock.sendMessage(groupJid, { text: `⏰ *10s left!*` });
      }

      if (timeLeft <= 0) {
        clearInterval(game.roundTimer);
        game.roundTimer = null;

        // Double check we're still on this round
        const checkGame = rtwGames.get(groupJid);
        if (!checkGame || checkGame.roundId !== currentRoundId) return;

        await sock.sendMessage(groupJid, {
          text: `⏰ *Time's up!*\n✅ Answer: *${checkGame.currentWord}*`
        });

        if (checkGame.round % 5 === 0) {
          await showRTWLeaderboard(sock, groupJid);
        }

        setTimeout(() => startRTWRound(sock, groupJid), 2500);
      }
    } catch (err) {
      logger.error({ error: err.message }, 'RTW round timer error');
      clearInterval(game.roundTimer);
      game.roundTimer = null;
    }
  }, 1000);
};

// Handle RTW answer
const handleRTWAnswer = async (sock, groupJid, playerJid, answer, messageKey) => {
  const game = rtwGames.get(groupJid);
  if (!game || game.phase !== 'PLAYING' || !game.currentWord) return false;

  // Only players who joined can answer
  if (!game.players.has(playerJid)) return false;

  const cleanAnswer = answer.trim().toUpperCase();
  
  // Quick length check
  if (cleanAnswer.length !== game.currentWord.length) return false;

  // Check if correct
  if (cleanAnswer === game.currentWord) {
    // Stop the timer immediately
    if (game.roundTimer) {
      clearInterval(game.roundTimer);
      game.roundTimer = null;
    }

    // Increment round ID to invalidate any pending timer callbacks
    game.roundId++;

    // Award point
    const player = game.players.get(playerJid);
    player.score++;

    await sock.sendMessage(groupJid, {
      react: { text: '✅', key: messageKey }
    });

    await sock.sendMessage(groupJid, {
      text: `@${playerJid.split('@')[0]} got it!\n*${game.currentWord}*\nScore: ${player.score}`,
      mentions: [playerJid]
    });

    if (game.round % 5 === 0) {
      await showRTWLeaderboard(sock, groupJid);
    }

    setTimeout(() => startRTWRound(sock, groupJid), 2500);
    return true;
  }

  return false;
};

// Show RTW leaderboard
const showRTWLeaderboard = async (sock, groupJid) => {
  const game = rtwGames.get(groupJid);
  if (!game) return;

  const sorted = Array.from(game.players.entries())
    .sort(([,a], [,b]) => b.score - a.score);

  if (sorted.length === 0) return;

  let text = `*Leaderboard*\n`;
  sorted.slice(0, 5).forEach(([jid, p], i) => {
    const medal = i === 0 ? '[1st]' : i === 1 ? '[2nd]' : i === 2 ? '[3rd]' : `${i+1}.`;
    text += `${medal} @${jid.split('@')[0]}: ${p.score}\n`;
  });

  await sock.sendMessage(groupJid, {
    text,
    mentions: sorted.slice(0, 5).map(([jid]) => jid)
  });
};

// ============================================
// WCG (Word Chain Game) System
// ============================================

// Validate word using Free Dictionary API
const validateWordAPI = async (word) => {
  try {
    const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`, {
      timeout: 5000
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
};

// Create WCG game
const WCG_MAX_DURATION = 15 * 60 * 1000; // 15 min max game duration
const RTW_MAX_DURATION = 20 * 60 * 1000; // 20 min max game duration

const createWCGGame = (groupJid, starterJid) => {
  const game = {
    groupJid,
    starterJid,
    players: [], // Array of { jid, name }
    playerOrder: [], // JIDs in play order
    currentPlayerIndex: 0,
    phase: 'JOINING', // JOINING, PLAYING, FINISHED
    round: 1,
    roundId: 0, // Guard against stale timer callbacks
    usedWords: new Set(),
    currentLetter: null,
    requiredLength: 0,
    turnTimer: null,
    joinTimer: null,
    gameTimer: null, // Max duration safety timer
    longestWord: { word: '', player: null, length: 0 },
    eliminatedPlayers: [],
    createdAt: Date.now()
  };
  wcgGames.set(groupJid, game);
  return game;
};

// Get random letter (excluding rare letters)
const getRandomLetter = () => {
  const letters = 'ABCDEFGHIJKLMNOPRSTUVW'; // Excluded Q, X, Y, Z for fairness
  return letters.charAt(Math.floor(Math.random() * letters.length));
};

// Get required word length based on round
const getRequiredLength = (round) => {
  if (round >= 25) {
    return Math.floor(Math.random() * 4) + 7; // 7-10 letters
  } else if (round >= 13) {
    return Math.floor(Math.random() * 3) + 6; // 6-8 letters
  } else {
    return Math.floor(Math.random() * 5) + 4; // 4-8 letters
  }
};

// Get time limit based on round
const getTimeLimit = (round) => {
  if (round >= 25) return 25;
  if (round >= 13) return 30;
  return 45;
};

// Start WCG join phase
const startWCGJoinPhase = async (sock, groupJid) => {
  const game = wcgGames.get(groupJid);
  if (!game) return;

  let timeLeft = 60;

  await sock.sendMessage(groupJid, {
    text: `*WCG GAME*\n\nType *Join* to play!\n${timeLeft}s left`
  });

  game.joinTimer = setInterval(async () => {
    const currentGame = wcgGames.get(groupJid);
    if (!currentGame || currentGame.phase !== 'JOINING') {
      clearInterval(game.joinTimer);
      return;
    }

    timeLeft--;

    if (timeLeft === 30 || timeLeft === 10) {
      await sock.sendMessage(groupJid, {
        text: `⏱️ *${timeLeft}s left to join!* (${currentGame.players.length} joined)`
      });
    }

    if (timeLeft <= 0) {
      clearInterval(game.joinTimer);
      
      if (currentGame.players.length < 2) {
        await sock.sendMessage(groupJid, {
          text: `❌ *WCG Cancelled*\nNeed at least 2 players!`
        });
        wcgGames.delete(groupJid);
        return;
      }

      // Start the game
      currentGame.phase = 'PLAYING';
      currentGame.playerOrder = currentGame.players.map(p => p.jid);
      
      // Shuffle player order
      for (let i = currentGame.playerOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [currentGame.playerOrder[i], currentGame.playerOrder[j]] = [currentGame.playerOrder[j], currentGame.playerOrder[i]];
      }

      await startWCGRound(sock, groupJid);
    }
  }, 1000);
};

// Start a WCG round/turn
const startWCGRound = async (sock, groupJid) => {
  const game = wcgGames.get(groupJid);
  if (!game || game.phase !== 'PLAYING') return;

  game.roundId++;
  const currentRoundId = game.roundId;

  // Check if we have a winner
  if (game.playerOrder.length === 1) {
    await endWCGGame(sock, groupJid, game.playerOrder[0]);
    return;
  }

  const currentPlayerJid = game.playerOrder[game.currentPlayerIndex];
  const nextPlayerIndex = (game.currentPlayerIndex + 1) % game.playerOrder.length;
  const nextPlayerJid = game.playerOrder[nextPlayerIndex];

  game.currentLetter = getRandomLetter();
  game.requiredLength = getRequiredLength(game.round);
  const timeLimit = getTimeLimit(game.round);

  let difficultyTag = '';
  if (game.round >= 25) difficultyTag = '*EXTREME*';
  else if (game.round >= 13) difficultyTag = '⚡ *HARD*';

  await sock.sendMessage(groupJid, {
    text: `*WCG Round ${game.round}* ${difficultyTag}\n\nPlayer: @${currentPlayerJid.split('@')[0]}\nStarts with: *${game.currentLetter}*\nMin letters: *${game.requiredLength}*`,
    mentions: [currentPlayerJid, nextPlayerJid]
  });

  // Start turn timer
  let timeLeft = timeLimit;
  game.turnTimer = setInterval(async () => {
    try {
      const currentGame = wcgGames.get(groupJid);
      // Guard: check game exists, is playing, and roundId matches (prevents stale callbacks)
      if (!currentGame || currentGame.phase !== 'PLAYING' || currentGame.roundId !== currentRoundId) {
        clearInterval(game.turnTimer);
        game.turnTimer = null;
        return;
      }

      timeLeft--;

      if (timeLeft === 10) {
        await sock.sendMessage(groupJid, {
          text: `⏰ @${currentPlayerJid.split('@')[0]} *10s left!*`,
          mentions: [currentPlayerJid]
        });
      }

      if (timeLeft <= 0) {
        clearInterval(game.turnTimer);
        game.turnTimer = null;
        const checkGame = wcgGames.get(groupJid);
        if (!checkGame || checkGame.roundId !== currentRoundId) return;
        await eliminateWCGPlayer(sock, groupJid, currentPlayerJid, 'time');
      }
    } catch (err) {
      logger.error({ error: err.message }, 'WCG turn timer error');
      clearInterval(game.turnTimer);
      game.turnTimer = null;
    }
  }, 1000);
};

// Eliminate a player
const eliminateWCGPlayer = async (sock, groupJid, playerJid, reason) => {
  const game = wcgGames.get(groupJid);
  if (!game) return;

  const player = game.players.find(p => p.jid === playerJid);
  game.eliminatedPlayers.push(playerJid);
  game.playerOrder = game.playerOrder.filter(jid => jid !== playerJid);
  game.roundId++; // Invalidate any stale callbacks

  const reasonText = reason === 'time' ? 'ran out of time!' : 'is out!';

  await sock.sendMessage(groupJid, {
    text: `@${playerJid.split('@')[0]} ${reasonText}\n*${game.playerOrder.length} players left*`,
    mentions: [playerJid]
  });

  // Check for winner
  if (game.playerOrder.length === 1) {
    await endWCGGame(sock, groupJid, game.playerOrder[0]);
    return;
  }

  // Adjust current player index if needed
  if (game.currentPlayerIndex >= game.playerOrder.length) {
    game.currentPlayerIndex = 0;
  }

  game.round++;
  
  // Small delay before next round
  setTimeout(() => startWCGRound(sock, groupJid), 2000);
};

// Handle WCG word submission
const handleWCGWord = async (sock, groupJid, playerJid, word, messageKey) => {
  const game = wcgGames.get(groupJid);
  if (!game || game.phase !== 'PLAYING') return false;

  const currentPlayerJid = game.playerOrder[game.currentPlayerIndex];
  
  // Only current player can answer
  if (playerJid !== currentPlayerJid) return false;

  const cleanWord = word.trim().toUpperCase();

  // Check if starts with correct letter
  if (!cleanWord.startsWith(game.currentLetter)) {
    await sock.sendMessage(groupJid, {
      text: `❌ Doesn't start with *${game.currentLetter}*!`
    });
    return true;
  }

  // Check length
  if (cleanWord.length < game.requiredLength) {
    await sock.sendMessage(groupJid, {
      text: `❌ Not enough letters! Need *${game.requiredLength}+*`
    });
    return true;
  }

  // Check if already used
  if (game.usedWords.has(cleanWord)) {
    await sock.sendMessage(groupJid, {
      text: `❌ This word has been used!`
    });
    return true;
  }

  // Validate with API
  const isValid = await validateWordAPI(cleanWord);
  if (!isValid) {
    await sock.sendMessage(groupJid, {
      text: `❌ Not in my dictionary!`
    });
    return true;
  }

  // Word is correct!
  if (game.turnTimer) {
    clearInterval(game.turnTimer);
    game.turnTimer = null;
  }
  game.roundId++; // Invalidate any stale timer callbacks
  game.usedWords.add(cleanWord);

  // Track longest word
  if (cleanWord.length > game.longestWord.length) {
    game.longestWord = {
      word: cleanWord,
      player: playerJid,
      length: cleanWord.length
    };
  }

  // React with checkmark
  await sock.sendMessage(groupJid, {
    react: { text: '✅', key: messageKey }
  });

  // Move to next player
  game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.playerOrder.length;
  game.round++;

  // Small delay before next round
  setTimeout(() => startWCGRound(sock, groupJid), 1500);
  return true;
};

// End WCG game
const endWCGGame = async (sock, groupJid, winnerJid) => {
  const game = wcgGames.get(groupJid);
  if (!game) return;

  game.phase = 'FINISHED';
  
  if (game.turnTimer) clearInterval(game.turnTimer);
  if (game.joinTimer) clearInterval(game.joinTimer);

  const winner = game.players.find(p => p.jid === winnerJid);

  // Update stats
  if (!wcgStats[groupJid]) {
    wcgStats[groupJid] = {
      wins: {},
      longestWord: { word: '', player: null, length: 0 },
      totalGames: 0
    };
  }

  const stats = wcgStats[groupJid];
  stats.totalGames++;
  
  // Update wins
  if (!stats.wins[winnerJid]) {
    stats.wins[winnerJid] = 0;
  }
  stats.wins[winnerJid]++;

  // Update longest word record
  if (game.longestWord.length > stats.longestWord.length) {
    stats.longestWord = { ...game.longestWord };
  }

  // Find all-time winner
  let allTimeWinner = null;
  let maxWins = 0;
  for (const [jid, wins] of Object.entries(stats.wins)) {
    if (wins > maxWins) {
      maxWins = wins;
      allTimeWinner = jid;
    }
  }

  const longestWordPlayer = game.longestWord.player;

  const mentions = [winnerJid];
  if (longestWordPlayer) mentions.push(longestWordPlayer);
  if (allTimeWinner) mentions.push(allTimeWinner);

  let resultText = `*WCG WINNER*\n\n@${winnerJid.split('@')[0]}\n\nLongest Word: *${game.longestWord?.word || 'N/A'}* (${game.longestWord?.word?.length || 0} letters)`;
  if (allTimeWinner) {
    resultText += `\n\nAll-Time Champ: @${allTimeWinner.split('@')[0]} (${maxWins} wins)`;
  }

  await sock.sendMessage(groupJid, {
    text: resultText,
    mentions: [...new Set(mentions)]
  });

  saveData();
  if (game.gameTimer) clearTimeout(game.gameTimer);
  wcgGames.delete(groupJid);
};

// Force end WCG game
const forceEndWCGGame = async (sock, groupJid) => {
  const game = wcgGames.get(groupJid);
  if (!game) return false;

  game.phase = 'FINISHED';
  if (game.turnTimer) { clearInterval(game.turnTimer); game.turnTimer = null; }
  if (game.joinTimer) { clearInterval(game.joinTimer); game.joinTimer = null; }
  if (game.gameTimer) { clearTimeout(game.gameTimer); game.gameTimer = null; }

  await sock.sendMessage(groupJid, {
    text: `*WCG game ended by admin*`
  });

  wcgGames.delete(groupJid);
  return true;
};

// ============================================
// 400Q Game System (DM Only)
// ============================================

// Load questions from file
const load400Questions = () => {
  try {
    if (!fs.existsSync(QUESTIONS_FILE)) {
      logger.error('Questions file not found');
      return [];
    }
    const questions = fs.readFileSync(QUESTIONS_FILE, 'utf8')
      .split('\n')
      .map(q => q.trim())
      .filter(q => q.length > 0);
    
    logger.info({ count: questions.length }, '400Q questions loaded');
    return questions;
  } catch (error) {
    logger.error({ error: error.message }, 'Error loading 400Q questions');
    return [];
  }
};

// Create 400Q session
const create400QGame = (chatJid) => {
  const game = {
    chatJid,
    currentPlayer: 1,
    waitingForNumber: true,
    lastBotMessageId: null,
    createdAt: Date.now()
  };
  q400Games.set(chatJid, game);
  return game;
};

// Get random question
const getRandom400Question = () => {
  const questions = load400Questions();
  if (questions.length === 0) return null;
  return questions[Math.floor(Math.random() * questions.length)];
};

// End 400Q game
const end400QGame = (chatJid) => {
  q400Games.delete(chatJid);
};

// VCF contact export helper function
const generateVCF = (contacts) => {
  let vcfContent = '';

  for (const contact of contacts) {
    const phoneNumber = contact.id.split('@')[0].replace(/:/g, '');
    const name = contact.notify || contact.name || phoneNumber;

    vcfContent += 'BEGIN:VCARD\n';
    vcfContent += 'VERSION:3.0\n';
    vcfContent += `FN:${name}\n`;
    vcfContent += `TEL;TYPE=CELL:+${phoneNumber}\n`;
    vcfContent += 'END:VCARD\n';
  }

  return vcfContent;
};

// Status media download helper function
const downloadStatusMedia = async (statusMessage) => {
  try {
    let mediaData = null;
    let mediaType = null;
    let caption = "";

    const imageMsg = statusMessage?.imageMessage;
    const videoMsg = statusMessage?.videoMessage;

    if (imageMsg) {
      const stream = await downloadContentFromMessage(imageMsg, 'image');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }
      mediaData = buffer;
      mediaType = "image";
      caption = imageMsg.caption || "";
    } else if (videoMsg) {
      const stream = await downloadContentFromMessage(videoMsg, 'video');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }
      mediaData = buffer;
      mediaType = "video";
      caption = videoMsg.caption || "";
    }

    return { mediaData, mediaType, caption };
  } catch (error) {
    logger.error({ error: error.message }, 'Status download error');
    return null;
  }
};

// Format uptime
const formatUptime = () => {
  const ms = Date.now() - botStartTime;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

const getMenu = () => `
╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
│        👻  S I L V E R   B O T  👻
│      ◈ C Y B E R P U N K • U I ◈
│       「 Community Manager 」
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

╭─〔 ⚡ SYSTEM STATUS 〕────────────────╮
│ 👑 Owner    │ ${BOT_OWNER || 'Unknown'}
│ 🌐 Mode     │ ${botMode.toUpperCase()}
│ ⏱ Uptime    │ ${formatUptime()}
│ 🚀 Version  │ v2.0.0
│
│ 🟣 CPU    ▰▰▰▰▰▰▱▱▱ 70%
│ 🔵 RAM    ▰▰▰▰▰▰▰▰▱ 90%
│ 🟢 BOT    ▰▰▰▰▰▰▰▰▰ ONLINE
╰──────────────────────────────────────╯

╔══════════════ 👥 GROUP ══════════════╗
║ 🔒 lock          🔓 open   
║ 👢 kick          ⚠️ warn. 
║ ♻️ unwarn        ⬆️ promote 
║ ⬇️ demote        🚫 block
║ ✅ unblock       🚪 left
║ 📥 acceptall     ❌ rejectall
║ 🌙 nightmode on|off 🏋️trackactivity status
║ 🏋️👀trackactivity on|off                  
╚══════════════════════════════════════╝

╔════════ 🏆 MEMBER MANAGEMENT ════════╗
║ 📊 listactive
║ 👻 inactive
║ 🦵 kickinactive
║ ✅ confirmkick
║ ❌ cancelkick
╚══════════════════════════════════════╝

╔══════════════ 💬 CHAT ═══════════════╗
║ 🔗 antilink       🖼 antiphoto
║ 📢 antistatus     🏷 antitag
║ 🚫 antispam       👥 tagall
║ 👤 hidetag        ➕ add
║ 👋 welcome        👋 goodbye
║ ✍️ setwelcome     ♻️ resetwelcome
║ ✍️ setgoodbye     ♻️ resetgoodbye
╚══════════════════════════════════════╝

╔══════════════ 🎮 GAMES ══════════════╗
║ 🎭 anonymous
║ 🔤 rtw
║ 🔗 wcg
║ 📈 wcgstat
║ ❓ 400q
║ ⛔ end
╚══════════════════════════════════════╝

╔════════════ 🎨 STICKERS ═════════════╗
║ 🖼 sticker
║ ⭐ setsticker
╚══════════════════════════════════════╝

╔════════════ 🛠 UTILITIES ════════════╗
║ 👁 vv            💾 save
║ 👤 getpp         🎵 play
║ 🏓 ping          🗑 delete
║ 📇 vcf           🌍 tr
║ 😴 afk           😊 back
║ 🖼 toimg         🎧 tomp3
╚══════════════════════════════════════╝

╔═══════════ 📥 DOWNLOADS ═════════════╗
║ 🎵 tt
╚══════════════════════════════════════╝

╔════════════ 💰 CRYPTO ═══════════════╗
║ 📈 live
╚══════════════════════════════════════╝

╔════════════ ⚙ SETTINGS ═════════════╗
║ 🌍 public        🔒 private
║ 🛡 antidel       👑 sudo
║ ❌ delsudo       📜 listsudo
║ ➕ join          📖 menu
║ ❔ help          ⚙️ setprefix 
╚══════════════════════════════════════╝

╭────────── 🤖 AUTO FEATURES ──────────╮
│ 🌙 Night Mode          ● ACTIVE
│ ☀️ Morning Mode        ● ACTIVE
│ 📊 Weekly Reset        ● ACTIVE
│ 👻 Ghost Warning       ● ACTIVE
│ 🏆 Weekly Champion     ● ACTIVE
╰──────────────────────────────────────╯

╭───────────── ⚡ POWER CORE ───────────╮
│ Neon Signal   ▰▰▰▰▰▰▰▰▰ 100%
│ Security      ▰▰▰▰▰▰▰▰▱ 90%
│ Performance   ▰▰▰▰▰▰▰▱▱ 80%
╰──────────────────────────────────────╯

╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
│      ✦ THANKS FOR USING SILVER ✦
│
│ 💻 Powered by ᭄ 𝑆𝑖𝑙𝑣𝑒𝑟᭄ ✞
│ 📞 wa.me/2349034763687
│
│ 「 Stay Sharp • Stay Silver 」
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
`;


async function startBot() {
  // Load saved data on startup
  loadData();

  const { state, saveCreds } = await useMultiFileAuthState("auth_info");

  const socketLogger = pino({ 
    level: process.env.DEBUG_BAILEYS === 'true' ? 'debug' : 'warn',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  });

  const { version } = await fetchLatestBaileysVersion();
  
  const sock = makeWASocket({
  auth: state,
  logger: require("pino")({ level: "silent" }),
  printQRInTerminal: false,
  version,
  browser: Browsers.ubuntu("Edge"),
});
currentSock = sock;
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      const phoneNumber = process.env.PHONE_NUMBER;

if (!phoneNumber) {
  throw new Error("PHONE_NUMBER variable not found");
}

try {
  if (!BOT_OWNER) {
    BOT_OWNER = phoneNumber;
    logger.info({ owner: BOT_OWNER }, 'Bot owner auto-detected from pairing');
  }

  const code = await sock.requestPairingCode(phoneNumber);
  console.log(`\nYour pairing code: ${code}\nEnter this in WhatsApp to connect`);
} catch (err) {
  logger.error({ error: err.message }, 'Pairing code error');
}
    }

    if (connection === "open") {
      console.clear();

      // Get the actual connected user's number
      const myNumber = sock.user.id.split(':')[0];

      // If BOT_OWNER is not set or different from connected number, update it
      if (!BOT_OWNER || BOT_OWNER !== myNumber) {
        BOT_OWNER = myNumber;
        saveData(); // Save the owner immediately
        logger.info({ owner: BOT_OWNER }, 'Bot owner auto-detected and saved');
      }

      const ownerJid = normalizeJid(BOT_OWNER);
      await sock.sendMessage(ownerJid, {
        text: `╭━━━━━━━━━━━━━━━━━╮
┃  🤖 *SILVER BOT v2.0* 👻
╰━━━━━━━━━━━━━━━━━╯

✅ *Status:* Connected Successfully!
⚡ *Mode:* ${botMode.toUpperCase()}
👤 *Owner:* +${BOT_OWNER}
⏰ *Time:* ${new Date().toLocaleString()}

━━━━━━━━━━━━━━━━━━━
📌 Type ${PREFIX}menu to see all available commands
━━━━━━━━━━━━━━━━━━━
💻 Powered by ᭄ 𝑆𝑖𝑙𝑣𝑒𝑟᭄ ✞`,
      });
      console.log("   Connected Successfully!   ");
      console.log(`\nBot Owner: +${BOT_OWNER}`);
      console.log(`My JID: ${sock.user.id}`);
      console.log(`Working Dir: ${process.cwd()}`);
      console.log(`Bot Mode: ${botMode.toUpperCase()}\n`);
      logger.info({ owner: BOT_OWNER, userJid: sock.user.id }, 'Bot connected and running');
      if (!nightCronStarted) {
  nightCronStarted = true;

  logger.info("🌙 Night Mode scheduler started.");

  cron.schedule("0 0 * * *", async () => {
  logger.info("🌙 Night Mode triggered.");

  for (const groupId of nightModeGroups) {
    try {
      // Send the Night Mode announcement
      await currentSock.sendMessage(groupId, {
        text: `╭━━━〔 🌙 NIGHT MODE 〕━━━╮

⚠️ *Good night everyone!*

🔒 This group has been automatically closed.

👮 Only admins can send messages for now.

😴 Have a peaceful night and see you tomorrow.

🤖 *Automated by SILVER BOT*

╰━━━━━━━━━━━━━━━━━━━━━━╯`
      });

      // Close the group
      await currentSock.groupSettingUpdate(groupId, "announcement");

      logger.info({ groupId }, "Night Mode: Group closed");
    } catch (err) {
      logger.error(
        { groupId, error: err.message },
        "Night Mode close failed"
      );
    }
  }
}, {
  timezone: "Africa/Lagos"
});

    // Morning Mode: Opens groups every day at 6:00 AM (Nigeria time)
cron.schedule("0 6 * * *", async () => {
  logger.info("☀️ Morning Mode triggered.");

  for (const groupId of nightModeGroups) {
    try {
      // Open the group
      await currentSock.groupSettingUpdate(groupId, "not_announcement");

      // Send the Morning Mode announcement
      await currentSock.sendMessage(groupId, {
        text: `╭━━━〔 ☀️ GOOD MORNING 〕━━━╮

🌞 *Rise and shine!*

📢 This group is now OPEN.

✅ Everyone can send messages again.

💙 Wishing you all a productive and amazing day!

🤖 *Automated by SILVER BOT*

╰━━━━━━━━━━━━━━━━━━━━━━╯`
      });

      logger.info({ groupId }, "Morning Mode: Group opened");
    } catch (err) {
      logger.error(
        { groupId, error: err.message },
        "Morning Mode open failed"
      );
    }
  }
}, {
  timezone: "Africa/Lagos"
});
        // Weekly Activity Reset - Every Monday at 12:00 AM (Nigeria time)
  cron.schedule("0 0 * * 1", async () => {
    // Ghost Warning - Every Friday at 8:00 PM (Nigeria time)
cron.schedule("0 20 * * 5", async () => {

  logger.info("👻 Ghost Warning started.");

  for (const groupId in groupActivity) {
    if (!activityTracking[groupId]) continue;

  try {

  const groupMetadata = await currentSock.groupMetadata(groupId);
    const inactive = await getInactiveMembers(
  groupMetadata,
  groupActivity[groupId],
  myJid,
  50
);

if (inactive.length === 0) {
  continue;
}
const mentions = inactive.map(user => user.jid);

let text = `╭━━━〔 👻 GHOST WARNING 〕━━━╮

⚠️ *Inactive Members Detected*

📉 Members with fewer than *50 messages* this week:

`;

inactive.forEach((user, index) => {
  text += `${index + 1}. @${user.jid.split("@")[0]} — ${user.count} messages\n`;
});

text += `

⏳ You have until *Sunday* to become active.

💬 Start chatting now to avoid removal!

🤖 *Automated by SILVER BOT*

╰━━━━━━━━━━━━━━━━━━━━━━╯`;

await currentSock.sendMessage(groupId, {
  text,
  mentions
});
  logger.info({
    group: groupMetadata.subject,
    members: groupMetadata.participants.length
  }, "Group loaded successfully.");

} catch (err) {

  logger.error(
    { groupId, error: err.message },
    "Failed to load group metadata."
  );

}

}

  logger.info("✅ Ghost Warning completed.");

}, {
  timezone: "Africa/Lagos"
});

    // Weekly Champion - Every Sunday at 8:00 PM (Nigeria time)
cron.schedule("0 20 * * 0", async () => {

  logger.info("🏆 Weekly Champion started.");

  for (const groupId in groupActivity) {
    if (!activityTracking[groupId]) continue;

  try {

    const groupMetadata = await currentSock.groupMetadata(groupId);

    const activity = groupActivity[groupId] || {};
    const highestCount = Math.max(
  0,
  ...Object.values(activity).map(user => user.count)
);

if (highestCount === 0) {
  continue;
}

const champions = Object.entries(activity)
  .filter(([_, data]) => data.count === highestCount)
  .map(([jid, data]) => ({
    jid,
    count: data.count
  }));

    const mentions = champions.map(user => user.jid);

let text = `╭━━━〔 🏆 WEEKLY CHAMPION 〕━━━╮

🎉 *Congratulations!*

`;

if (champions.length === 1) {

  text += `👑 This week's champion is:

🥇 @${champions[0].jid.split("@")[0]}

💬 Messages: ${champions[0].count}

🏅 Congratulations on becoming this week's most active member!

Will you defend your crown next week? 👑

`;

} else {

  text += `👑 We have *${champions.length} Co-Champions!*\n\n`;

  champions.forEach((user, index) => {
    text += `🥇 ${index + 1}. @${user.jid.split("@")[0]} — ${user.count} messages\n`;
  });

  text += `\n🤝 Incredible! It's a tie at the top!\n\n`;

}

text += `━━━━━━━━━━━━━━━━━━━━

📅 Next Championship:
Next Sunday • 8:00 PM

🤖 *Automated by SILVER BOT*

╰━━━━━━━━━━━━━━━━━━━━━━╯`;

await currentSock.sendMessage(groupId, {
  text,
  mentions
});

  } catch (err) {

    logger.error(
      { groupId, error: err.message },
      "Weekly Champion failed."
    );

  }

}

  logger.info("✅ Weekly Champion completed.");

}, {
  timezone: "Africa/Lagos"
});
    logger.info("📊 Weekly Activity Reset started.");

    for (const groupId in groupActivity) {
      if (!activityTracking[groupId]) continue;

  for (const userId in groupActivity[groupId]) {

    // Reset only the weekly message count
    groupActivity[groupId][userId].count = 0;

  }

  try {

    await currentSock.sendMessage(groupId, {
      text: `╭━━━〔 📊 WEEKLY ACTIVITY RESET 〕━━━╮

🎉 *A new activity week has begun!*

💬 Everyone's weekly message count has been reset.

🏆 Stay active this week to avoid being listed as inactive.

🔥 Good luck everyone!

🤖 *Automated by SILVER BOT*

╰━━━━━━━━━━━━━━━━━━━━━━╯`
    });

  } catch (err) {

    logger.error(
      { groupId, error: err.message },
      "Failed to send Weekly Activity Reset message"
    );

  }

}

    saveData();

    logger.info("✅ Weekly Activity Reset completed.");

  }, {
    timezone: "Africa/Lagos"
  });
      }
      const myJid = sock.user.id;
      try {
        const successImagePath = path.join(__dirname, 'images/success.jpg');
        const successImage = fs.readFileSync(successImagePath);
        await sock.sendMessage(myJid, {
          image: successImage,
          caption: `CONNECTION SUCCESSFUL

SILVER Bot is online!
Built by: SILVER

Quick Start:
.menu - View all commands
.help - Bot information
.ping - Check status
.public/.private - Toggle mode

Current Mode: ${botMode.toUpperCase()}
Ready to manage!`,
        });
      } catch (err) {
        logger.debug({ error: err.message }, 'Success image not found, sending text only');
        await sock.sendMessage(myJid, {
          text: `CONNECTION SUCCESSFUL

SILVER Bot is online!
Built by: _SILVER_

Quick Start:
.menu - View all commands
.help - Bot information
.ping - Check status
.public/.private - Toggle mode

Current Mode: ${botMode.toUpperCase()}
Ready to manage!`,
        });
      }

      // Start polling for anonymous messages every 3 seconds
      setInterval(() => {
        pollAnonymousMessages(sock).catch(err => {
          logger.error({ error: err.message }, 'Anonymous polling error');
        });
      }, 3000);

      // Check for expired anonymous sessions every 60 seconds
      setInterval(() => {
        checkAnonymousSessionExpiry(sock).catch(err => {
          logger.error({ error: err.message }, 'Anonymous session expiry check error');
        });
      }, 60000);
    }

    if (connection === "close") {
      if (
        lastDisconnect?.error?.output?.statusCode ===
        DisconnectReason.loggedOut
      ) {
        logger.error('Device logged out. Delete auth_info folder to reconnect.');
        process.exit(0);
      }
      logger.info('Connection closed, reconnecting...');
      setTimeout(() => startBot(), 3000);
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("group-participants.update", async (update) => {
    const { id, participants, action } = update;
    const groupJid = id;

    if (action === 'add') {
      // Check if welcome is enabled for this group (disabled by default)
      if (!welcomeEnabled[groupJid]) {
        return;
      }

      for (const participant of participants) {
        // Ensure participant is a string (sometimes it's an object)
        const participantJid = typeof participant === 'string' ? participant : participant?.id || participant?.jid || String(participant);
        if (!participantJid || typeof participantJid !== 'string') {
          logger.warn({ participant }, 'Invalid participant format in welcome');
          continue;
        }
        
        // Check if there's a custom welcome message for this group
        let welcomeMessage;
        const username = participantJid.split('@')[0];

        if (customWelcomeMessages[groupJid]) {
          // Use custom welcome message with placeholder replacements
          try {
            // Get group metadata for placeholders
            const groupMeta = await sock.groupMetadata(groupJid);
            const groupName = groupMeta.subject || 'Group';
            const groupDesc = groupMeta.desc || 'No description';
            const memberCount = groupMeta.participants?.length || 0;

            // Check for image placeholders
            const hasGrpPP = customWelcomeMessages[groupJid].includes('{grppp}');
            const hasUserPP = customWelcomeMessages[groupJid].includes('{userpp}');

            // Replace all placeholders
            welcomeMessage = customWelcomeMessages[groupJid]
              .replace(/{user}/g, `@${username}`)
              .replace(/{username}/g, username)
              .replace(/{groupname}/g, groupName)
              .replace(/{desc}/g, groupDesc)
              .replace(/{membercount}/g, memberCount.toString())
              .replace(/{grppp}/g, '')
              .replace(/{userpp}/g, '')
              .trim();

            // If image placeholder is used, fetch the profile picture and send as image
            const defaultAvatarPath = path.join(__dirname, 'images', 'default_avatar.png');
            let ppUrl = null;
            if (hasUserPP) {
              try {
                ppUrl = await sock.profilePictureUrl(participantJid, 'image');
              } catch (e) {
                try {
                  ppUrl = await sock.profilePictureUrl(participantJid, 'display');
                } catch (e2) {
                  // no profile pic available
                }
              }
            } else if (hasGrpPP) {
              try {
                ppUrl = await sock.profilePictureUrl(groupJid, 'image');
              } catch (e) {
                try {
                  ppUrl = await sock.profilePictureUrl(groupJid, 'display');
                } catch (e2) {
                  // no profile pic available
                }
              }
            }

            if (hasGrpPP || hasUserPP) {
              // Send as image with caption — use profile pic or default avatar
              try {
                let ppBuffer;
                if (ppUrl) {
                  const ppResponse = await axios.get(ppUrl, { responseType: 'arraybuffer', timeout: 10000 });
                  ppBuffer = Buffer.from(ppResponse.data);
                } else {
                  // No profile pic — use default anonymous avatar
                  ppBuffer = fs.readFileSync(defaultAvatarPath);
                }
                await sock.sendMessage(groupJid, {
                  image: ppBuffer,
                  caption: welcomeMessage,
                  mentions: [participantJid]
                });
              } catch (ppErr) {
                // Fallback to local default avatar if URL download fails
                logger.error({ error: ppErr.message }, 'Failed to fetch profile pic, using default avatar');
                try {
                  const defBuffer = fs.readFileSync(defaultAvatarPath);
                  await sock.sendMessage(groupJid, {
                    image: defBuffer,
                    caption: welcomeMessage,
                    mentions: [participantJid]
                  });
                } catch (defErr) {
                  await sock.sendMessage(groupJid, {
                    text: welcomeMessage,
                    mentions: [participantJid]
                  });
                }
              }
            } else {
              // Send as regular text
              await sock.sendMessage(groupJid, {
                text: welcomeMessage,
                mentions: [participantJid]
              });
            }
          } catch (error) {
            // Fallback if metadata fails
            welcomeMessage = customWelcomeMessages[groupJid].replace(/{user}/g, `@${username}`).replace(/{grppp}/g, '').replace(/{userpp}/g, '').trim();
            logger.error({ error: error.message }, 'Error getting group metadata for welcome');
            await sock.sendMessage(groupJid, {
              text: welcomeMessage,
              mentions: [participantJid]
            });
          }
        } else {
          // Default welcome message
          welcomeMessage = `👋 *Welcome to the Group!*

Hello @${username}, we're glad to have you here!

*Silver* is here to help. Type *.menu* to see all available commands.

Please read the group rules and enjoy your stay!`;
        }

        // Only send message here if there was NO custom welcome (custom is handled above with image support)
        if (!customWelcomeMessages[groupJid]) {
          await sock.sendMessage(groupJid, {
            text: welcomeMessage,
            mentions: [participantJid]
          });
        }
      }
    } else if (action === 'remove') {
      // Check if goodbye is enabled for this group (disabled by default)
      if (!goodbyeEnabled[groupJid]) {
        return;
      }

      for (const participant of participants) {
        // Ensure participant is a string
        const participantJid = typeof participant === 'string' ? participant : participant?.id || participant?.jid || String(participant);
        if (!participantJid || typeof participantJid !== 'string') continue;
        
        const username = participantJid.split('@')[0];
        let goodbyeMessage;

        if (customGoodbyeMessages[groupJid]) {
          // Use custom goodbye message with placeholder replacements
          try {
            const groupMeta = await sock.groupMetadata(groupJid);
            const groupName = groupMeta.subject || 'Group';
            const groupDesc = groupMeta.desc || 'No description';
            const memberCount = groupMeta.participants?.length || 0;

            const hasGrpPP = customGoodbyeMessages[groupJid].includes('{grppp}');
            const hasUserPP = customGoodbyeMessages[groupJid].includes('{userpp}');

            goodbyeMessage = customGoodbyeMessages[groupJid]
              .replace(/{user}/g, `@${username}`)
              .replace(/{username}/g, username)
              .replace(/{groupname}/g, groupName)
              .replace(/{desc}/g, groupDesc)
              .replace(/{membercount}/g, memberCount.toString())
              .replace(/{grppp}/g, '')
              .replace(/{userpp}/g, '')
              .trim();

            const defaultAvatarPath = path.join(__dirname, 'images', 'default_avatar.png');
            let ppUrl = null;
            if (hasUserPP) {
              try {
                ppUrl = await sock.profilePictureUrl(participantJid, 'image');
              } catch (e) {
                try { ppUrl = await sock.profilePictureUrl(participantJid, 'display'); } catch (e2) {}
              }
            } else if (hasGrpPP) {
              try {
                ppUrl = await sock.profilePictureUrl(groupJid, 'image');
              } catch (e) {
                try { ppUrl = await sock.profilePictureUrl(groupJid, 'display'); } catch (e2) {}
              }
            }

            if (hasGrpPP || hasUserPP) {
              try {
                let ppBuffer;
                if (ppUrl) {
                  const ppResponse = await axios.get(ppUrl, { responseType: 'arraybuffer', timeout: 10000 });
                  ppBuffer = Buffer.from(ppResponse.data);
                } else {
                  ppBuffer = fs.readFileSync(defaultAvatarPath);
                }
                await sock.sendMessage(groupJid, {
                  image: ppBuffer,
                  caption: goodbyeMessage,
                  mentions: [participantJid]
                });
              } catch (ppErr) {
                logger.error({ error: ppErr.message }, 'Failed to fetch goodbye profile pic');
                try {
                  const defBuffer = fs.readFileSync(defaultAvatarPath);
                  await sock.sendMessage(groupJid, {
                    image: defBuffer,
                    caption: goodbyeMessage,
                    mentions: [participantJid]
                  });
                } catch (defErr) {
                  await sock.sendMessage(groupJid, { text: goodbyeMessage, mentions: [participantJid] });
                }
              }
            } else {
              await sock.sendMessage(groupJid, { text: goodbyeMessage, mentions: [participantJid] });
            }
          } catch (error) {
            goodbyeMessage = customGoodbyeMessages[groupJid].replace(/{user}/g, `@${username}`).replace(/{grppp}/g, '').replace(/{userpp}/g, '').trim();
            logger.error({ error: error.message }, 'Error in custom goodbye message');
            await sock.sendMessage(groupJid, { text: goodbyeMessage, mentions: [participantJid] });
          }
        } else {
          // Default goodbye message
          goodbyeMessage = `👋 *Goodbye!*

@${username} has left the group.

We hope to see you again soon!`;
        }

        // Only send here if there was NO custom goodbye (custom is handled above with image support)
        if (!customGoodbyeMessages[groupJid]) {
          await sock.sendMessage(groupJid, {
            text: goodbyeMessage,
            mentions: [participantJid]
          });
        }
      }
    }
  });

  // ============================================
  // Anti-Delete: Detect deleted messages
  // ============================================
  sock.ev.on("messages.update", async (updates) => {
    if (!antiDeleteEnabled) return;
    
    for (const update of updates) {
      // Check if message was deleted (revoked)
      if (update.update?.messageStubType === 1 || update.update?.message === null) {
        const messageId = update.key?.id;
        const cachedMsg = messageCache.get(messageId);
        
        if (cachedMsg && BOT_OWNER) {
          try {
            const ownerJid = BOT_OWNER.includes('@') ? BOT_OWNER : BOT_OWNER + '@s.whatsapp.net';
            const senderNumber = cachedMsg.sender.split('@')[0];
            
            // Get group name if it's a group message
            let location = 'DM';
            if (cachedMsg.isGroup) {
              try {
                const groupMeta = await sock.groupMetadata(cachedMsg.remoteJid);
                location = groupMeta.subject || 'Unknown Group';
              } catch (err) {
                location = 'Group';
              }
            }
            
            // Build the anti-delete message
            let antiDelMsg = `┌─────────────┐\n   *ANTI-DEL*\n└─────────────┘\n\n`;
            antiDelMsg += `👤 *Name:* ${cachedMsg.senderName}\n`;
antiDelMsg += `🆔 *User:* ${senderNumber}\n`;
            antiDelMsg += `📍 *From:* ${location}\n`;
            antiDelMsg += `⏰ *Time:* ${new Date(cachedMsg.timestamp).toLocaleString()}\n\n`;
            
            // Check message type and send accordingly
            const msg = cachedMsg.message;
            
            if (msg.imageMessage) {
              // Deleted image
              const stream = await downloadContentFromMessage(msg.imageMessage, 'image');
              let buffer = Buffer.from([]);
              for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
              }
              
              await sock.sendMessage(ownerJid, {
                image: buffer,
                caption: antiDelMsg + `📷 *Type:* Image\n${msg.imageMessage.caption ? `\n💬 *Caption:* ${msg.imageMessage.caption}` : ''}`
              });
            } else if (msg.videoMessage) {
              // Deleted video
              const stream = await downloadContentFromMessage(msg.videoMessage, 'video');
              let buffer = Buffer.from([]);
              for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
              }
              
              await sock.sendMessage(ownerJid, {
                video: buffer,
                caption: antiDelMsg + `🎥 *Type:* Video\n${msg.videoMessage.caption ? `\n💬 *Caption:* ${msg.videoMessage.caption}` : ''}`
              });
            } else if (msg.audioMessage) {
              // Deleted audio
              const stream = await downloadContentFromMessage(msg.audioMessage, 'audio');
              let buffer = Buffer.from([]);
              for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
              }
              
              await sock.sendMessage(ownerJid, {
                text: antiDelMsg + `🎵 *Type:* Audio/Voice Note`
              });
              await sock.sendMessage(ownerJid, {
                audio: buffer,
                mimetype: msg.audioMessage.mimetype || 'audio/mp4',
                ptt: msg.audioMessage.ptt || false
              });
            } else if (msg.stickerMessage) {
              // Deleted sticker
              const stream = await downloadContentFromMessage(msg.stickerMessage, 'sticker');
              let buffer = Buffer.from([]);
              for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
              }
              
              await sock.sendMessage(ownerJid, {
                text: antiDelMsg + `🎨 *Type:* Sticker`
              });
              await sock.sendMessage(ownerJid, {
                sticker: buffer
              });
            } else if (msg.documentMessage) {
              // Deleted document
              const stream = await downloadContentFromMessage(msg.documentMessage, 'document');
              let buffer = Buffer.from([]);
              for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
              }
              
              await sock.sendMessage(ownerJid, {
                document: buffer,
                fileName: msg.documentMessage.fileName || 'document',
                mimetype: msg.documentMessage.mimetype,
                caption: antiDelMsg + `📄 *Type:* Document`
              });
            } else if (msg.viewOnceMessage || msg.viewOnceMessageV2) {
              // Deleted view-once message
              const viewOnce = msg.viewOnceMessage?.message || msg.viewOnceMessageV2?.message;
              
              if (viewOnce?.imageMessage) {
                const stream = await downloadContentFromMessage(viewOnce.imageMessage, 'image');
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                  buffer = Buffer.concat([buffer, chunk]);
                }
                
                await sock.sendMessage(ownerJid, {
                  image: buffer,
                  caption: antiDelMsg + `👁️ *Type:* View-Once Image\n${viewOnce.imageMessage.caption ? `\n💬 *Caption:* ${viewOnce.imageMessage.caption}` : ''}`
                });
              } else if (viewOnce?.videoMessage) {
                const stream = await downloadContentFromMessage(viewOnce.videoMessage, 'video');
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                  buffer = Buffer.concat([buffer, chunk]);
                }
                
                await sock.sendMessage(ownerJid, {
                  video: buffer,
                  caption: antiDelMsg + `👁️ *Type:* View-Once Video\n${viewOnce.videoMessage.caption ? `\n💬 *Caption:* ${viewOnce.videoMessage.caption}` : ''}`
                });
              }
            } else if (cachedMsg.text) {
              // Deleted text message
              antiDelMsg += `💬 *Message:*\n${cachedMsg.text}`;
              await sock.sendMessage(ownerJid, { text: antiDelMsg });
            } else {
              // Unknown type
              antiDelMsg += `❓ *Type:* Unknown message type`;
              await sock.sendMessage(ownerJid, { text: antiDelMsg });
            }
            
            // Remove from cache after processing
            messageCache.delete(messageId);
            
          } catch (err) {
            logger.error({ error: err.message }, 'Anti-delete error');
          }
        }
      }
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    try {
      const message = m.messages[0];
// ============================================
// ULTRALIGHT SIMULTANEOUS DIRECT THREAD REACTOR
// ============================================

      if (!message.message) return;

// ============================================
// Activity Tracker
// ============================================

if (message.key.remoteJid.endsWith("@g.us") && !message.key.fromMe) {
  const groupId = message.key.remoteJid;
  const userId = message.key.participant;

  if (!groupActivity[groupId]) {
    groupActivity[groupId] = {};
  }

  if (!groupActivity[groupId][userId]) {
    groupActivity[groupId][userId] = {
      count: 0,
      lastMessage: Date.now()
    };
  }

  groupActivity[groupId][userId].count++;
  groupActivity[groupId][userId].lastMessage = Date.now();

  // Auto-save every 20 messages to reduce disk writes
  if (groupActivity[groupId][userId].count % 20 === 0) {
    saveData();
  }
}

      const isGroup = message.key.remoteJid.endsWith("@g.us");
      const isDM = !isGroup;

      // ============================================
      // EXP SYSTEM — AUTOMATIC MESSAGE XP
      // ============================================
      if (
        isGroup &&
        !message.key.fromMe &&
        expEnabled[message.key.remoteJid]
      ) {
        const groupJid = message.key.remoteJid;
        const userJid =
          message.key.participant ||
          message.key.remoteJid;

        const cooldownKey = `${groupJid}:${userJid}`;
        const now = Date.now();
        const lastExpTime = expCooldowns.get(cooldownKey) || 0;

        // Prevent EXP farming by message spam
        if (now - lastExpTime >= EXP_COOLDOWN) {
          const earnedExp =
            Math.floor(
              Math.random() * (EXP_MAX - EXP_MIN + 1)
            ) + EXP_MIN;

          if (!userExp[groupJid]) {
            userExp[groupJid] = {};
          }

          if (!userExp[groupJid][userJid]) {
            userExp[groupJid][userJid] = {
              exp: 0,
              level: 1
            };
          }

          const userData = userExp[groupJid][userJid];

          const oldLevel = userData.level;
          const oldTitle = getExpTitle(oldLevel);

          userData.exp += earnedExp;

          const newLevel = calculateLevel(userData.exp);
          const newTitle = getExpTitle(newLevel);

          userData.level = newLevel;

          expCooldowns.set(cooldownKey, now);

          // ============================================
          // LEVEL UP NOTIFICATION
          // ============================================
          if (newLevel > oldLevel) {
            const titleChanged = newTitle !== oldTitle;

            await sock.sendMessage(groupJid, {
              text:
                "╭━━━〔 🎉 LEVEL UP! 〕━━━╮\\n\\n" +
                `👤 @${userJid.split("@")[0]}\\n` +
                `⭐ *Level ${newLevel}*\\n` +
                `🏅 *${newTitle}*\\n` +
                `✨ EXP: *${userData.exp}*\\n\\n` +
                (titleChanged
                  ? "🎖️ *NEW RANK TITLE UNLOCKED!*\\n\\n"
                  : "🔥 Keep chatting to reach the next level!\\n\\n") +
                "╰━━━━━━━━━━━━━━━━━━━━╯",
              mentions: [userJid]
            });
          }

          // Save EXP progress
          saveData();
        }
      }
      let sender = message.key.participant || message.key.remoteJid;
      const myJid = sock.user.id;
      const displaySender =
  message.key.remoteJidAlt ||
  message.key.participantAlt ||
  sender;
      const isSender = sender === myJid;

      let text = "";
      if (message.message.conversation)
        text = message.message.conversation;
      else if (message.message.extendedTextMessage)
        text = message.message.extendedTextMessage.text;
      else if (message.message.imageMessage?.caption)
        text = message.message.imageMessage.caption;
      else if (message.message.videoMessage?.caption)
        text = message.message.videoMessage.caption;

      // ============================================
      // Anti-Delete: Cache messages for recovery
      // ============================================
      if (antiDeleteEnabled && !message.key.fromMe) {
        const messageId = message.key.id;
        const cacheData = {
  id: messageId,
  sender: displaySender,
  senderName: message.pushName || "Unknown",
  remoteJid: message.key.remoteJid,
  text: text,
  timestamp: Date.now(),
  message: message.message,
  isGroup: isGroup
};
        
        // Store in cache
        messageCache.set(messageId, cacheData);
        
        // Clean old messages from cache (keep last MAX_CACHE_SIZE)
        if (messageCache.size > MAX_CACHE_SIZE) {
          const oldestKey = messageCache.keys().next().value;
          messageCache.delete(oldestKey);
        }
      }

      // Ignore bot's own "." messages (used for hidetag)
      if (message.key.fromMe && text === ".") {
        return;
      }

      // ============================================
      // AFK System - Check & Handle
      // ============================================
      
      // Check if sender is AFK and remove them (they're back)
      if (afkUsers[sender]) {
        const afkData = afkUsers[sender];
        const duration = Math.floor((Date.now() - afkData.time) / 60000); // minutes
        delete afkUsers[sender];
        saveData();
        
        await sock.sendMessage(message.key.remoteJid, {
          text: `🔙 *Welcome back!*\n\nYou were AFK for ${duration} minute${duration !== 1 ? 's' : ''}.`,
          mentions: [sender]
        });
      }
      
      // Check if message mentions any AFK users
      const mentionedJids = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      for (const mentionedJid of mentionedJids) {
        if (afkUsers[mentionedJid]) {
          const afkData = afkUsers[mentionedJid];
          const duration = Math.floor((Date.now() - afkData.time) / 60000);
          const reason = afkData.reason || 'No reason given';
          
          await sock.sendMessage(message.key.remoteJid, {
            text: `😴 *@${mentionedJid.split('@')[0]} is AFK*\n\n📝 Reason: ${reason}\n⏱️ Since: ${duration} minute${duration !== 1 ? 's' : ''} ago`,
            mentions: [mentionedJid]
          });
        }
      }

      // Only log commands, not every message (reduces spam)
      // Debug logs removed to reduce VM log spam

      // Determine if this is the owner
      let isOwner = false;
      let isSudo = false;

      if (isDM) {
        // In self-DM (fromMe: true), the sender is a LID, but it's still the owner
        // Check if this is your own number or LID
        const isSelfDM = message.key.fromMe || 
                         message.key.remoteJid.includes(BOT_OWNER) ||
                         sender.includes(BOT_OWNER);

        if (isSelfDM) {
          isOwner = true;
        } else {
          isOwner = isOwnerNumber(sender);
          isSudo = isSudoUser(sender);
        }
      } else {
        // In groups, check if message is fromMe first (handles LID)
        // If fromMe is true, it's the bot owner sending the message
        if (message.key.fromMe) {
          isOwner = true;
          // Verbose logging disabled
          // logger.info({ sender, fromMe: true }, 'GROUP: Detected as owner (fromMe=true)');
        } else {
          // For other users, use standard owner check
          isOwner = isOwnerNumber(sender);
          isSudo = isSudoUser(sender);
          // Verbose logging disabled
          // logger.info({ sender, BOT_OWNER, isOwner, isSudo }, 'GROUP: Owner/Sudo check completed');
        }
      }

      // Sudo users can use bot like owner (except sudo management commands)
      const canUseAsOwner = isOwner || isSudo;

      const fullCommand = text?.toLowerCase().trim().split(" ")[0];
      
      // Check if this is a sticker message (needs to bypass command check)
      const hasStickerMessage = !!message.message?.stickerMessage;
      
      if (!fullCommand || !fullCommand.startsWith(PREFIX)) {
        // Not a command, but check for game interactions OR sticker messages
        if (hasStickerMessage) {
          // Sticker message - DON'T return, continue to sticker detection below
          // Verbose logging disabled
          // logger.info({ hasStickerMessage, sender, isGroup, isDM }, 'STICKER: Non-command sticker detected, continuing to sticker detection');
          // Fall through to the code below - don't return
        } else if (isGroup && (rtwGames.has(message.key.remoteJid) || wcgGames.has(message.key.remoteJid))) {
          // Group game logic will handle this below
        } else if (isDM && q400Games.has(message.key.remoteJid)) {
          // 400Q game logic - handle number replies and "next" command
          const game = q400Games.get(message.key.remoteJid);
          const textLower = text?.toLowerCase().trim();
          
          // Handle "next" command to switch players
          if (textLower === 'next') {
            game.currentPlayer = game.currentPlayer === 1 ? 2 : 1;
            game.waitingForNumber = true;
            
            const sentMsg = await sock.sendMessage(message.key.remoteJid, {
              text: `Player ${game.currentPlayer}: Pick a number from 1-400`
            });
            game.lastBotMessageId = sentMsg.key.id;
            return;
          }
          
          // Handle number reply (must be replying to bot's message)
          const quotedId = message.message?.extendedTextMessage?.contextInfo?.stanzaId;
          if (game.waitingForNumber && quotedId === game.lastBotMessageId) {
            const num = parseInt(text.trim());
            if (!isNaN(num) && num >= 1 && num <= 400) {
              const question = getRandom400Question();
              if (question) {
                game.waitingForNumber = false;
                await sock.sendMessage(message.key.remoteJid, {
                  text: `Question:\n\n${question}`
                });
              } else {
                await sock.sendMessage(message.key.remoteJid, {
                  text: `❌ Could not load questions!`
                });
              }
            }
          }
          return;
        } else if (!isGroup) {
          return;
        }
      }

      const command = fullCommand?.startsWith(PREFIX)
  ? fullCommand.slice(PREFIX.length)
  : (fullCommand || "");
      const args = text?.trim().split(" ").slice(1) || [];

      // Ignore single dot or empty command - BUT allow sticker messages and group messages through (for anti-* enforcement)
      if ((command === "" || command === ".") && !hasStickerMessage && !isGroup) return;

      // Handle WCG game messages (Join and word submissions)
      if (isGroup && wcgGames.has(message.key.remoteJid)) {
        const game = wcgGames.get(message.key.remoteJid);
        const textLower = text?.toLowerCase().trim();
        
        // Handle Join phase
        if (game.phase === 'JOINING' && textLower === 'join') {
          const alreadyJoined = game.players.some(p => p.jid === sender);
          if (!alreadyJoined) {
            game.players.push({
              jid: sender,
              name: sender.split('@')[0]
            });
            
            await sock.sendMessage(message.key.remoteJid, {
              text: `✅ @${sender.split('@')[0]} joined! (${game.players.length} players)`,
              mentions: [sender]
            });
          }
          return;
        }
        
        // Handle playing phase - word submissions
        if (game.phase === 'PLAYING') {
          const handled = await handleWCGWord(sock, message.key.remoteJid, sender, text, message.key);
          if (handled) return;
        }
      }

      // Handle RTW game messages (Join and answers)
      if (isGroup && rtwGames.has(message.key.remoteJid)) {
        const game = rtwGames.get(message.key.remoteJid);
        const textLower = text?.toLowerCase().trim();
        
        // Handle Join phase
        if (game.phase === 'JOINING' && textLower === 'join') {
          if (!game.players.has(sender)) {
            game.players.set(sender, {
              name: sender.split('@')[0],
              score: 0
            });
            
            await sock.sendMessage(message.key.remoteJid, {
              text: `✅ @${sender.split('@')[0]} joined! (${game.players.size} players)`,
              mentions: [sender]
            });
          }
          return;
        }
        
        // Handle playing phase - answers
        if (game.phase === 'PLAYING' && game.currentWord) {
          const handled = await handleRTWAnswer(sock, message.key.remoteJid, sender, text, message.key);
          if (handled) return;
        }
      }

      if (text && text.startsWith(PREFIX)) {
        console.log('\n' + '='.repeat(60));
        console.log(`Command: ${command}`);
        console.log(`Sender: ${sender}`);
        console.log(`Is Owner: ${isOwner ? 'YES' : 'NO'}`);
        console.log(`Location: ${isGroup ? 'GROUP' : 'DM'}`);
        console.log(`Bot Mode: ${botMode.toUpperCase()}`);
        console.log(`Bot Owner: ${BOT_OWNER}`);
        console.log('='.repeat(60) + '\n');

        logger.info({
          command,
          sender,
          isOwner,
          isDM,
          isGroup,
          botMode,
          BOT_OWNER,
          remoteJid: message.key.remoteJid,
          fromMe: message.key.fromMe,
        }, 'Command detected');
      }

      if (isGroup) {
        const groupMetadata = await sock.groupMetadata(message.key.remoteJid);
        const isAdmin = groupMetadata.participants.some(
          (p) =>
            p.id === sender &&
            (p.admin === "admin" || p.admin === "superadmin")
        ) || isOwner;

        // Check if user is actual group admin (without owner override)
        const isGroupAdmin = groupMetadata.participants.some(
          (p) =>
            p.id === sender &&
            (p.admin === "admin" || p.admin === "superadmin")
        );

        // Check if owner is admin in the group
        // Since the message is fromMe=true and isOwner=true, we just need to check if the sender is admin
        const ownerIsAdmin = groupMetadata.participants.some(
          (p) => {
            const isAdmin = p.admin === "admin" || p.admin === "superadmin";
            
            // Check if this participant matches the sender (you)
            // The sender is your actual participant ID in this group context
            const isSender = p.id === sender || normalizeJid(p.id) === normalizeJid(sender);
            
            // Verbose logging disabled to reduce console spam
            // logger.info({
            //   participantId: p.id,
            //   sender,
            //   myJid,
            //   isAdmin,
            //   isSender,
            //   botOwner: BOT_OWNER
            // }, 'Admin check details');
            
            return isSender && isAdmin;
          }
        );

        // Verbose logging disabled
        // logger.info({
        //   ownerJid: normalizeJid(BOT_OWNER + "@s.whatsapp.net"),
        //   ownerIsAdmin,
        //   participantsCount: groupMetadata.participants.length
        // }, 'OWNER ADMIN CHECK');

        const settings = adminSettings[message.key.remoteJid];
        const antilinkMode = settings?.antilink; // 'kick', 'warn', or false/undefined
        if (antilinkMode && !isAdmin && !canUseAsOwner && !message.key.fromMe) {
          if (isLinkMessage(text)) {
            const groupId = message.key.remoteJid;
            const userNumber = sender.split("@")[0];
            logger.info({ sender, group: groupId, mode: antilinkMode }, 'Link detected - taking action');

            // Delete the link message first
            try {
              await sock.sendMessage(groupId, { delete: message.key });
              logger.info('Link message deleted');
            } catch (err) {
              logger.error({ error: err.message }, 'Failed to delete link message');
            }

            if (antilinkMode === 'kick') {
              // Kick immediately
              try {
                await sock.groupParticipantsUpdate(groupId, [sender], "remove");
                await sock.sendMessage(groupId, {
                  text: `@${userNumber} has been removed for sending a link.`,
                  mentions: [sender]
                });
                logger.info({ sender }, 'User kicked for sending link');
              } catch (err) {
                logger.error({ error: err.message }, 'Failed to kick user');
                await sock.sendMessage(groupId, {
                  text: `@${userNumber} sent a link. Could not remove - bot needs admin.`,
                  mentions: [sender]
                });
              }
            } else {
              // Warn mode (handles 'warn' and legacy true value)
              if (!userWarns[groupId]) userWarns[groupId] = {};
              if (!userWarns[groupId][sender]) userWarns[groupId][sender] = 0;
              userWarns[groupId][sender]++;
              const warnCount = userWarns[groupId][sender];
              saveData();

              if (warnCount >= 3) {
                try {
                  await sock.groupParticipantsUpdate(groupId, [sender], "remove");
                  await sock.sendMessage(groupId, {
                    text: `@${userNumber} removed (3 link warnings).`,
                    mentions: [sender]
                  });
                  delete userWarns[groupId][sender];
                  saveData();
                  logger.info({ sender }, 'User kicked for sending link (3 warnings)');
                } catch (err) {
                  logger.error({ error: err.message }, 'Failed to kick user');
                  await sock.sendMessage(groupId, {
                    text: `@${userNumber} has 3 warnings. Could not remove - bot needs admin.`,
                    mentions: [sender]
                  });
                }
              } else {
                await sock.sendMessage(groupId, {
                  text: `⚠️ Warning ${warnCount}/3 @${userNumber} - No links allowed.`,
                  mentions: [sender]
                });
              }
            }
            return;
          }
        }

        // ============================================
        // Anti-Photo Enforcement (delete images/videos that are not view-once)
        // ============================================
        const antiPhotoAction = antiPhotoGroups[message.key.remoteJid];
        if (antiPhotoAction && !isAdmin && !canUseAsOwner && !message.key.fromMe) {
          // Check for view-once wrappers first — these should ALWAYS be allowed
          console.log("MESSAGE KEYS:", Object.keys(message.message || {}));

console.log(
  "IMAGE viewOnce:",
  message.message?.imageMessage?.viewOnce
);

console.log(
  "VIDEO viewOnce:",
  message.message?.videoMessage?.viewOnce
);

const isViewOnce =
  !!message.message?.viewOnceMessage ||
  !!message.message?.viewOnceMessageV2 ||
  !!message.message?.viewOnceMessageV2Extension ||
  !!message.message?.imageMessage?.viewOnce ||
  !!message.message?.videoMessage?.viewOnce;
          // Only check for direct (non-viewonce) images/videos
          const hasImage = !isViewOnce && !!message.message.imageMessage;
          const hasVideo = !isViewOnce && !!message.message.videoMessage;
          
          if (hasImage || hasVideo) {
            const groupId = message.key.remoteJid;
            const userNumber = sender.split("@")[0];
            
            // Delete the message
            try {
              await sock.sendMessage(groupId, { delete: message.key });
            } catch (err) {
              logger.error({ error: err.message }, 'Failed to delete photo/video');
            }
            
            if (antiPhotoAction === 'kick') {
              try {
                await sock.groupParticipantsUpdate(groupId, [sender], "remove");
                await sock.sendMessage(groupId, {
                  text: `🚫 @${userNumber} removed. Only View Once Photo/Video are allowed here.`,
                  mentions: [sender]
                });
              } catch (err) {
                logger.error({ error: err.message }, 'Failed to kick user (antiphoto)');
              }
            } else if (antiPhotoAction === 'warn') {
              if (!userWarns[groupId]) userWarns[groupId] = {};
              if (!userWarns[groupId][sender]) userWarns[groupId][sender] = 0;
              userWarns[groupId][sender]++;
              const warnCount = userWarns[groupId][sender];
              saveData();
              
              if (warnCount >= 3) {
                try {
                  await sock.groupParticipantsUpdate(groupId, [sender], "remove");
                  await sock.sendMessage(groupId, {
                    text: `🚫 @${userNumber} removed (3 warnings). Only View Once Photo/Video are allowed here.`,
                    mentions: [sender]
                  });
                  delete userWarns[groupId][sender];
                  saveData();
                } catch (err) {
                  logger.error({ error: err.message }, 'Failed to kick user (antiphoto warn)');
                }
              } else {
                await sock.sendMessage(groupId, {
                  text: `⚠️ Warning ${warnCount}/3 @${userNumber} - Only View Once Photo/Video are allowed here.`,
                  mentions: [sender]
                });
              }
            }
            return;
          }
        }

        // ============================================
        // Anti-Status Enforcement (delete status mention/tag messages)
        // ============================================
     console.log('REMOTE JID:', message.key.remoteJid);
console.log('MESSAGE TYPE:', Object.keys(message.message || {}));
        
        const antiStatusAction = antiStatusGroups[message.key.remoteJid];
        if (antiStatusAction && !isAdmin && !canUseAsOwner && !message.key.fromMe) {
          // Detect status share/mention messages in groups
          // When someone mentions a group in their status, WhatsApp sends the status to that group
          // These messages have specific patterns in their structure
          const msg = message.message;
          const contextInfo = msg.extendedTextMessage?.contextInfo || 
                              msg.imageMessage?.contextInfo || 
                              msg.videoMessage?.contextInfo ||
                              msg.viewOnceMessage?.message?.imageMessage?.contextInfo ||
                              msg.viewOnceMessage?.message?.videoMessage?.contextInfo ||
                              msg.viewOnceMessageV2?.message?.imageMessage?.contextInfo ||
                              msg.viewOnceMessageV2?.message?.videoMessage?.contextInfo;
          
          // Check for status@broadcast in various places
          const isStatusMention =
    contextInfo?.remoteJid === 'status@broadcast' ||
    msg?.groupStatusMentionMessage ||
    msg?.statusMentionMessage ||
    msg?.imageMessage?.contextInfo?.remoteJid === 'status@broadcast' ||
    msg?.videoMessage?.contextInfo?.remoteJid === 'status@broadcast' ||
    msg?.extendedTextMessage?.contextInfo?.remoteJid === 'status@broadcast' ||
    msg?.ephemeralMessage?.message?.extendedTextMessage?.contextInfo?.remoteJid === 'status@broadcast' ||
    msg?.ephemeralMessage?.message?.imageMessage?.contextInfo?.remoteJid === 'status@broadcast' ||
    msg?.ephemeralMessage?.message?.videoMessage?.contextInfo?.remoteJid === 'status@broadcast';
          if (isStatusMention) {
            const groupId = message.key.remoteJid;
            const userNumber = sender.split("@")[0];
            
            try {
              await sock.sendMessage(groupId, { delete: message.key });
            } catch (err) {
              logger.error({ error: err.message }, 'Failed to delete status mention');
            }
            
            if (antiStatusAction === 'kick') {
              try {
                await sock.groupParticipantsUpdate(groupId, [sender], "remove");
                await sock.sendMessage(groupId, {
                  text: `🚫 @${userNumber} removed for sharing status in group (antistatus).`,
                  mentions: [sender]
                });
              } catch (err) {
                logger.error({ error: err.message }, 'Failed to kick user (antistatus)');
              }
            } else if (antiStatusAction === 'warn') {
              if (!userWarns[groupId]) userWarns[groupId] = {};
              if (!userWarns[groupId][sender]) userWarns[groupId][sender] = 0;
              userWarns[groupId][sender]++;
              const warnCount = userWarns[groupId][sender];
              saveData();
              
              if (warnCount >= 3) {
                try {
                  await sock.groupParticipantsUpdate(groupId, [sender], "remove");
                  await sock.sendMessage(groupId, {
                    text: `🚫 @${userNumber} removed (3 status warnings).`,
                    mentions: [sender]
                  });
                  delete userWarns[groupId][sender];
                  saveData();
                } catch (err) {
                  logger.error({ error: err.message }, 'Failed to kick user (antistatus warn)');
                }
              } else {
                await sock.sendMessage(groupId, {
                  text: `⚠️ Warning ${warnCount}/3 @${userNumber} - No status sharing allowed.`,
                  mentions: [sender]
                });
              }
            }
            return;
          }
        }

        // ============================================
        // Anti-Tag Enforcement (prevent tagging all members)
        // ============================================
        const antiTagAction = antiTagGroups[message.key.remoteJid];
        if (antiTagAction && !isAdmin && !canUseAsOwner && !message.key.fromMe) {
          const mentionedJids = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
          const totalMembers = groupMetadata.participants.length;
          // If user mentions more than half the group or 10+ people, consider it mass tagging
          const isMassTag = mentionedJids.length >= Math.min(totalMembers * 0.5, 10) && mentionedJids.length >= 5;
          
          if (isMassTag) {
            const groupId = message.key.remoteJid;
            const userNumber = sender.split("@")[0];
            
            try {
              await sock.sendMessage(groupId, { delete: message.key });
            } catch (err) {
              logger.error({ error: err.message }, 'Failed to delete mass tag message');
            }
            
            if (antiTagAction === 'kick') {
              try {
                await sock.groupParticipantsUpdate(groupId, [sender], "remove");
                await sock.sendMessage(groupId, {
                  text: `🚫 @${userNumber} removed for mass tagging (antitag).`,
                  mentions: [sender]
                });
              } catch (err) {
                logger.error({ error: err.message }, 'Failed to kick user (antitag)');
              }
            } else if (antiTagAction === 'warn') {
              if (!userWarns[groupId]) userWarns[groupId] = {};
              if (!userWarns[groupId][sender]) userWarns[groupId][sender] = 0;
              userWarns[groupId][sender]++;
              const warnCount = userWarns[groupId][sender];
              saveData();
              
              if (warnCount >= 3) {
                try {
                  await sock.groupParticipantsUpdate(groupId, [sender], "remove");
                  await sock.sendMessage(groupId, {
                    text: `🚫 @${userNumber} removed (3 tag warnings).`,
                    mentions: [sender]
                  });
                  delete userWarns[groupId][sender];
                  saveData();
                } catch (err) {
                  logger.error({ error: err.message }, 'Failed to kick user (antitag warn)');
                }
              } else {
                await sock.sendMessage(groupId, {
                  text: `⚠️ Warning ${warnCount}/3 @${userNumber} - No mass tagging allowed.`,
                  mentions: [sender]
                });
              }
            }
            return;
          }
        }

        // ============================================
        // Anti-Spam Enforcement (rate-limit messages)
        // ============================================
        const antiSpamAction = antiSpamGroups[message.key.remoteJid];
        if (antiSpamAction && !isAdmin && !canUseAsOwner && !message.key.fromMe) {
          const groupId = message.key.remoteJid;
          const trackerKey = `${groupId}:${sender}`;
          const now = Date.now();
          let tracker = spamTracker.get(trackerKey);

          if (!tracker || (now - tracker.firstMsgTime > SPAM_WINDOW)) {
            // Reset window
            tracker = { count: 1, firstMsgTime: now, lastWarnTime: 0 };
            spamTracker.set(trackerKey, tracker);
          } else {
            tracker.count++;
          }

          if (tracker.count >= SPAM_THRESHOLD) {
            const userNumber = sender.split("@")[0];

            // Delete the spam message
            try {
              await sock.sendMessage(groupId, { delete: message.key });
            } catch (err) {
              logger.error({ error: err.message }, 'Failed to delete spam message');
            }

            if (antiSpamAction === 'kick') {
              try {
                await sock.groupParticipantsUpdate(groupId, [sender], "remove");
                await sock.sendMessage(groupId, {
                  text: `🚫 @${userNumber} removed for spamming.`,
                  mentions: [sender]
                });
              } catch (err) {
                logger.error({ error: err.message }, 'Failed to kick user (antispam)');
              }
              spamTracker.delete(trackerKey);
            } else if (antiSpamAction === 'warn') {
              // Only warn once per spam burst (avoid spamming warnings)
              if (now - tracker.lastWarnTime > 10000) {
                tracker.lastWarnTime = now;
                if (!userWarns[groupId]) userWarns[groupId] = {};
                if (!userWarns[groupId][sender]) userWarns[groupId][sender] = 0;
                userWarns[groupId][sender]++;
                const warnCount = userWarns[groupId][sender];
                saveData();

                if (warnCount >= 3) {
                  try {
                    await sock.groupParticipantsUpdate(groupId, [sender], "remove");
                    await sock.sendMessage(groupId, {
                      text: `🚫 @${userNumber} removed (3 spam warnings).`,
                      mentions: [sender]
                    });
                    delete userWarns[groupId][sender];
                    saveData();
                  } catch (err) {
                    logger.error({ error: err.message }, 'Failed to kick user (antispam warn)');
                  }
                  spamTracker.delete(trackerKey);
                } else {
                  await sock.sendMessage(groupId, {
                    text: `⚠️ Warning ${warnCount}/3 @${userNumber} - Slow down! No spamming.`,
                    mentions: [sender]
                  });
                }
              }
            }
            // Reset count after action
            tracker.count = 0;
            tracker.firstMsgTime = now;
            return;
          }
        }

        const canUseBot = canUseAsOwner || (botMode === "public");

        // Non-command group messages should return after anti-* enforcement
        // But allow sticker messages through for sticker command detection
        if ((!text || !text.startsWith(PREFIX)) && !hasStickerMessage) return;

        // Silent return for non-authorized users in private mode
        // Allow ONLY owner/sudo to use commands when in private mode
        if (!canUseBot && text && text.startsWith(PREFIX)) {
          logger.debug({ command, sender, botMode }, 'Non-owner attempted command in private mode - ignoring');
          return;
        }

        if (command === "menu") {
          const channelInfo = {
            contextInfo: {
              forwardingScore: 999,
              isForwarded: true,
              forwardedNewsletterMessageInfo: {
                newsletterJid: '120363407155737368@newsletter',
                newsletterName: 'SILVER BOT',
                serverMessageId: 127
              }
            }
          };
          try {
            const menuImagePath = path.join(__dirname, 'images/menu-image.jpg');
            const menuImage = fs.readFileSync(menuImagePath);
            await sock.sendMessage(message.key.remoteJid, {
              image: menuImage,
              caption: getMenu(),
              ...channelInfo
            });
          } catch (err) {
            logger.debug({ error: err.message }, 'Menu image not found, sending text only');
            await sock.sendMessage(message.key.remoteJid, {
              text: getMenu(),
              ...channelInfo
            });
          }
          return;
        }
        if (command === "prefix") {

  await sock.sendMessage(message.key.remoteJid, {
    text: `╭━━━〔 ⚙ CURRENT PREFIX 〕━━━╮

📌 Current Prefix: *${PREFIX}*

🤖 SILVER BOT

╰━━━━━━━━━━━━━━━━━━━━━━╯`
  });

  return;
        }
        if (command === "setprefix") {

  if (!isOwner) {
    await sock.sendMessage(message.key.remoteJid, {
      text: "❌ Only the bot owner can change the prefix."
    });
    return;
  }

  const newPrefix = args[0];

  if (!newPrefix) {
    await sock.sendMessage(message.key.remoteJid, {
      text: `Usage:\n\n${PREFIX}setprefix !`
    });
    return;
  }

  const oldPrefix = PREFIX;

  PREFIX = newPrefix;

  saveData();

  await sock.sendMessage(message.key.remoteJid, {
    text: `╭━━━〔 ⚙ PREFIX UPDATED 〕━━━╮

✅ Prefix changed successfully!

Old Prefix: ${oldPrefix}

New Prefix: ${PREFIX}

📌 Use ${PREFIX}menu from now on.

🤖 SILVER BOT

╰━━━━━━━━━━━━━━━━━━━━━━╯`
  });

  return;
        }
        if (command === "resetprefix") {

  if (!isOwner) {
    await sock.sendMessage(message.key.remoteJid, {
      text: "❌ Only the bot owner can reset the prefix."
    });
    return;
  }

  PREFIX = ".";

  saveData();

  await sock.sendMessage(message.key.remoteJid, {
    text: `╭━━━〔 ⚙ PREFIX RESET 〕━━━╮

✅ Prefix has been reset!

Current Prefix: ${PREFIX}

📌 Use ${PREFIX}menu from now on.

🤖 SILVER BOT

╰━━━━━━━━━━━━━━━━━━━━━━╯`
  });

  return;
}

        if (command === "ping") {
          const now = Date.now();
          await sock.sendMessage(message.key.remoteJid, {
            text: `PONG!\nBot is online and responding\nLatency: ${Date.now() - now}ms\nMode: ${botMode.toUpperCase()}`,
          });
          return;
        }

                // ============================================
        // List Active Members
        // ============================================
        if (command === "listactive") {
          if (!isGroup) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ This command only works in groups."
            });
            return;
          }

          const groupId = message.key.remoteJid;
          const activity = groupActivity[groupId] || {};

          if (Object.keys(activity).length === 0) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "No activity has been recorded yet."
            });
            return;
          }

          const sorted = Object.entries(activity)
            .sort((a, b) => b[1].count - a[1].count);

          let text = "📊 *ACTIVE MEMBERS*\n\n";
          const mentions = [];

          sorted.forEach(([jid, data], index) => {
            mentions.push(jid);
            text += `${index + 1}. @${jid.split("@")[0]} — ${data.count} messages\n`;
          });

          await sock.sendMessage(message.key.remoteJid, {
            text,
            mentions
          });

          return;
        }
        
        // ============================================
// EXP SYSTEM CONTROL
// ============================================
if (command === "exp") {

  if (!isGroup) {
    await sock.sendMessage(message.key.remoteJid, {
      text: "❌ This command only works in groups."
    });
    return;
  }

  // Admins, bot owner and sudo users only
  if (!isAdmin && !canUseAsOwner) {
    await sock.sendMessage(message.key.remoteJid, {
      text: "❌ Only group admins or sudo users can control the EXP system."
    });
    return;
  }

  const option = (args[0] || "").toLowerCase();
  const groupJid = message.key.remoteJid;

  if (option === "enable") {
    expEnabled[groupJid] = true;
    saveData();

    await sock.sendMessage(groupJid, {
      text:
        "╭━━━〔 ⭐ EXP SYSTEM 〕━━━╮\n\n" +
        "✅ *EXP system enabled!*\n\n" +
        "Members can now earn EXP by chatting in this group.\n" +
        "🎯 EXP is awarded automatically with a cooldown.\n\n" +
        "╰━━━━━━━━━━━━━━━━━━━━╯"
    });
    return;
  }

  if (option === "disable") {
    delete expEnabled[groupJid];
    saveData();

    await sock.sendMessage(groupJid, {
      text:
        "╭━━━〔 ⭐ EXP SYSTEM 〕━━━╮\n\n" +
        "❌ *EXP system disabled.*\n\n" +
        "Members will no longer gain EXP in this group.\n\n" +
        "╰━━━━━━━━━━━━━━━━━━━━╯"
    });
    return;
  }

  if (option === "status") {
    const enabled = !!expEnabled[groupJid];

    await sock.sendMessage(groupJid, {
      text:
        "╭━━━〔 ⭐ EXP SYSTEM 〕━━━╮\n\n" +
        `📊 Status: ${enabled ? "✅ Enabled" : "❌ Disabled"}\n\n` +
        "╰━━━━━━━━━━━━━━━━━━━━╯"
    });
    return;
  }

  await sock.sendMessage(groupJid, {
    text:
      "╭━━━〔 ⭐ EXP SYSTEM 〕━━━╮\n\n" +
      `• ${PREFIX}exp enable\n` +
      `• ${PREFIX}exp disable\n` +
      `• ${PREFIX}exp status\n\n` +
      "👮 Only group admins and sudo users can control EXP.\n\n" +
      "╰━━━━━━━━━━━━━━━━━━━━╯"
  });

  return;
}

// ============================================
// EXP RANK / LEVEL COMMAND
// ============================================
if (command === "rank" || command === "level") {

  if (!isGroup) {
    await sock.sendMessage(message.key.remoteJid, {
      text: "❌ This command only works in groups."
    });
    return;
  }

  const groupJid = message.key.remoteJid;

  // EXP must be enabled in this group
  if (!expEnabled[groupJid]) {
    await sock.sendMessage(groupJid, {
      text:
        "❌ *EXP system is disabled in this group.*\\n\\n" +
        `An admin can enable it with *${PREFIX}exp enable*.`
    });
    return;
  }

  const contextInfo =
    message.message?.extendedTextMessage?.contextInfo;

  let targetJid = null;

  // 1. Reply target
  if (contextInfo?.participant) {
    targetJid = contextInfo.participant;
  }

  // 2. Mention target
  if (!targetJid && contextInfo?.mentionedJid?.length) {
    targetJid = contextInfo.mentionedJid[0];
  }

  // 3. Default to command sender
  if (!targetJid) {
    targetJid =
      message.key.participant ||
      message.key.remoteJid;
  }

  if (!userExp[groupJid]) {
    userExp[groupJid] = {};
  }

  if (!userExp[groupJid][targetJid]) {
    userExp[groupJid][targetJid] = {
      exp: 0,
      level: 1
    };
  }

  const userData = userExp[groupJid][targetJid];

  const currentLevel = calculateLevel(userData.exp);
  const expTitle = getExpTitle(currentLevel);

  userData.level = currentLevel;

  // Total EXP required to reach the next level
  let expBeforeCurrentLevel = 0;

  for (let i = 1; i < currentLevel; i++) {
    expBeforeCurrentLevel += getExpRequired(i);
  }

  const currentLevelExp =
    userData.exp - expBeforeCurrentLevel;

  const nextLevelExp =
    getExpRequired(currentLevel);

  const progress =
    Math.min(
      100,
      Math.floor(
        (currentLevelExp / nextLevelExp) * 100
      )
    );

  const remaining =
    Math.max(
      0,
      nextLevelExp - currentLevelExp
    );

  const barLength = 12;

  const filled =
    Math.round(
      (progress / 100) * barLength
    );

  const progressBar =
    "█".repeat(filled) +
    "░".repeat(barLength - filled);

  await sock.sendMessage(groupJid, {
    text:
      "╭━━━〔 🏆 EXP RANK 〕━━━╮\\n\\n" +
      `👤 @${targetJid.split("@")[0]}\\n` +
      `🏅 *Title:* ${expTitle}\\n\\n` +
      `⭐ *Level:* ${currentLevel}\\n` +
      `✨ *EXP:* ${userData.exp}\\n\\n` +
      `${progressBar} *${progress}%*\\n\\n` +
      `📈 *Next Level:* ${nextLevelExp} EXP\\n` +
      `💫 *Remaining:* ${remaining} EXP\\n\\n` +
      "╰━━━━━━━━━━━━━━━━━━━━╯",
    mentions: [targetJid]
  });

  return;
}

// ============================================
// EXP LEADERBOARD
// ============================================
if (command === "expleaderboard" || command === "top") {

  if (!isGroup) {
    await sock.sendMessage(message.key.remoteJid, {
      text: "❌ This command only works in groups."
    });
    return;
  }

  const groupJid = message.key.remoteJid;

  // EXP must be enabled in this group
  if (!expEnabled[groupJid]) {
    await sock.sendMessage(groupJid, {
      text:
        "❌ *EXP system is disabled in this group.*\\n\\n" +
        `An admin can enable it with *${PREFIX}exp enable*.`
    });
    return;
  }

  const groupExp = userExp[groupJid] || {};

  const leaderboard = Object.entries(groupExp)
    .map(([jid, data]) => ({
      jid,
      exp: Number(data.exp) || 0,
      level: calculateLevel(Number(data.exp) || 0)
    }))
    .sort((a, b) => {
      if (b.exp !== a.exp) return b.exp - a.exp;
      return b.level - a.level;
    })
    .slice(0, 10);

  if (leaderboard.length === 0) {
    await sock.sendMessage(groupJid, {
      text:
        "╭━━━〔 🏆 EXP LEADERBOARD 〕━━━╮\\n\\n" +
        "📭 No EXP has been earned yet.\\n\\n" +
        `💬 Start chatting to earn EXP!\\n\\n` +
        "╰━━━━━━━━━━━━━━━━━━━━╯"
    });
    return;
  }

  const medals = ["🥇", "🥈", "🥉"];
  const mentions = [];

  let text =
    "╭━━━〔 🏆 EXP LEADERBOARD 〕━━━╮\\n\\n";

  leaderboard.forEach((user, index) => {
    const medal = medals[index] || `${index + 1}️⃣`;

    mentions.push(user.jid);

    text +=
      `${medal} @${user.jid.split("@")[0]}\\n` +
      `   ⭐ Level ${user.level} • ✨ ${user.exp} EXP\\n\\n`;
  });

  text += "╰━━━━━━━━━━━━━━━━━━━━╯";

  await sock.sendMessage(groupJid, {
    text,
    mentions
  });

  return;
}

// ============================================
// EXP LEADERBOARD
// ============================================
if (command === "leaderboard" || command === "lb" || command === "top") {

  if (!isGroup) {
    await sock.sendMessage(message.key.remoteJid, {
      text: "❌ This command only works in groups."
    });
    return;
  }

  const groupJid = message.key.remoteJid;

  if (!expEnabled[groupJid]) {
    await sock.sendMessage(groupJid, {
      text:
        "❌ *EXP system is disabled in this group.*\\n\\n" +
        `An admin can enable it with *${PREFIX}exp enable*.`
    });
    return;
  }

  const groupUsers = userExp[groupJid] || {};

  const ranked = Object.entries(groupUsers)
    .filter(([jid, data]) => data && Number(data.exp) > 0)
    .sort((a, b) => Number(b[1].exp) - Number(a[1].exp))
    .slice(0, 10);

  if (ranked.length === 0) {
    await sock.sendMessage(groupJid, {
      text:
        "╭━━━〔 🏆 EXP LEADERBOARD 〕━━━╮\\n\\n" +
        "📭 No members have earned EXP yet.\\n\\n" +
        `💬 Start chatting to become the first!\\n\\n` +
        "╰━━━━━━━━━━━━━━━━━━━━━━━━╯"
    });
    return;
  }

  const mentions = [];

  let text =
    "╭━━━〔 🏆 EXP LEADERBOARD 〕━━━╮\\n\\n" +
    "      ⭐ *TOP 10 MEMBERS* ⭐\\n\\n";

  ranked.forEach(([jid, data], index) => {

    const exp = Number(data.exp) || 0;
    const level = calculateLevel(exp);
    const title = getExpTitle(level);

    const medals = ["🥇", "🥈", "🥉"];
    const position = medals[index] || `*${index + 1}.*`;

    mentions.push(jid);

    text +=
      `${position} @${jid.split("@")[0]}\\n` +
      `   🏅 ${title} • ⭐ Lv.${level} • ✨ ${exp} EXP\\n\\n`;
  });

  text += "╰━━━━━━━━━━━━━━━━━━━━━━━━╯";

  await sock.sendMessage(groupJid, {
    text,
    mentions
  });

  return;
}

// ============================================
// Kick Inactive Members
// ============================================
if (command === "kickinactive") {

  if (!isGroup) {
    await sock.sendMessage(message.key.remoteJid, {
      text: "❌ This command only works in groups."
    });
    return;
  }

  if (!isAdmin && !canUseAsOwner) {
    await sock.sendMessage(message.key.remoteJid, {
      text: "❌ Only admins can use this command."
    });
    return;
  }

  const threshold = Number(args[0]) || 50;

  const groupMetadata = await sock.groupMetadata(message.key.remoteJid);

  const inactive = await getInactiveMembers(
    groupMetadata,
    groupActivity[message.key.remoteJid] || {},
    sock.user.id,
    threshold
  );

  if (inactive.length === 0) {
    await sock.sendMessage(message.key.remoteJid, {
      text: "✅ No inactive members found."
    });
    return;
  }

  pendingKickInactive[message.key.remoteJid] = inactive;

  let text =
`⚠️ *Inactive Members Found*

Threshold: ${threshold} messages

`;

  const mentions = [];

  inactive.forEach((user, i) => {
    mentions.push(user.jid);
    text += `${i + 1}. @${user.jid.split("@")[0]} — ${user.count} messages\n`;
  });

  text +=
`\nReply with:

*.confirmkick*

within 60 seconds to remove them.`;

  await sock.sendMessage(message.key.remoteJid,{
    text,
    mentions
  });

  setTimeout(() => {
    delete pendingKickInactive[message.key.remoteJid];
  },60000);

  return;
}

        // ============================================
// Confirm Kick Inactive Members
// ============================================
if (command === "confirmkick") {

  if (!isGroup) {
    await sock.sendMessage(message.key.remoteJid, {
      text: "❌ This command only works in groups."
    });
    return;
  }

  if (!isAdmin && !canUseAsOwner) {
    await sock.sendMessage(message.key.remoteJid, {
      text: "❌ Only admins can use this command."
    });
    return;
  }

  const pending = pendingKickInactive[message.key.remoteJid];

  if (!pending || pending.length === 0) {
    await sock.sendMessage(message.key.remoteJid, {
      text: "❌ There is no pending inactive member list.\n\nRun *.kickinactive* first."
    });
    return;
  }

  const users = pending.map(x => x.jid);

  try {

    await sock.groupParticipantsUpdate(
      message.key.remoteJid,
      users,
      "remove"
    );

    let text = `🧹 *Removed ${users.length} inactive members*\n\n`;

    pending.forEach((u, i) => {
      text += `${i + 1}. @${u.jid.split("@")[0]} (${u.count} messages)\n`;
    });

    await sock.sendMessage(message.key.remoteJid, {
      text,
      mentions: users
    });

    delete pendingKickInactive[message.key.remoteJid];

  } catch (err) {

    await sock.sendMessage(message.key.remoteJid, {
      text: `❌ Failed to remove members.\n\n${err.message}`
    });

  }

  return;
}

        // ============================================
// Cancel Kick Inactive Members
// ============================================
if (command === "cancelkick") {

  if (!isGroup) {
    await sock.sendMessage(message.key.remoteJid, {
      text: "❌ This command only works in groups."
    });
    return;
  }

  if (!isAdmin && !canUseAsOwner) {
    await sock.sendMessage(message.key.remoteJid, {
      text: "❌ Only admins can use this command."
    });
    return;
  }

  if (!pendingKickInactive[message.key.remoteJid]) {
    await sock.sendMessage(message.key.remoteJid, {
      text: "❌ There is no pending kick to cancel."
    });
    return;
  }

  delete pendingKickInactive[message.key.remoteJid];

  await sock.sendMessage(message.key.remoteJid, {
    text: "✅ Inactive member removal has been cancelled."
  });

  return;
}
      // ============================================
        // Inactive Members
        // ============================================
        if (command === "inactive") {
          if (!isGroup) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ This command only works in groups."
            });
            return;
          }

          const threshold = Number(args[0]) || 50;
          const groupId = message.key.remoteJid;
          const activity = groupActivity[groupId] || [];

          const inactive = [];
          const mentions = [];

          function formatLastSeen(timestamp) {
            if (!timestamp) return "Never";

            const diff = Date.now() - timestamp;
            const days = Math.floor(diff / 86400000);

            if (days <= 0) return "Today";
            if (days === 1) return "Yesterday";
            if (days < 7) return `${days} days ago`;

            const weeks = Math.floor(days / 7);

            if (weeks === 1) return "1 week ago";

            return `${weeks} weeks ago`;
          }

          for (const participant of groupMetadata.participants) {

            // Skip admins
            if (
              participant.admin === "admin" ||
              participant.admin === "superadmin"
            ) continue;

            // Skip bot
            if (normalizeJid(participant.id) === normalizeJid(myJid))
              continue;

            const data = activity[participant.id] || {
              count: 0,
              lastMessage: null
            };

            if (data.count < threshold) {
              inactive.push({
                jid: participant.id,
                count: data.count,
                lastMessage: data.lastMessage
              });
            }
          }

          inactive.sort((a, b) => a.count - b.count);

          if (inactive.length === 0) {
            await sock.sendMessage(message.key.remoteJid, {
              text: `✅ No inactive members found.\n\nThreshold: ${threshold} messages`
            });
            return;
          }

          let text =
`👻 *INACTIVE MEMBERS*\n\n📌 Threshold: *${threshold} messages*\n\n`;

          inactive.forEach((user, index) => {

            mentions.push(user.jid);

            text +=
`${index + 1}. @${user.jid.split("@")[0]}
💬 Messages: ${user.count}
🕒 Last Seen: ${formatLastSeen(user.lastMessage)}

`;
          });

          text += `━━━━━━━━━━━━━━
👥 Total Inactive: ${inactive.length}`;

          await sock.sendMessage(message.key.remoteJid, {
            text,
            mentions
          });

          return;
        }
        // ============================================
        // Anti-Delete Command (Owner Only)
        // ============================================
        if (command === "antidel" && canUseAsOwner) {
          const option = args[0]?.toLowerCase();
          
          if (option === "on") {
            antiDeleteEnabled = true;
            saveData();
            await sock.sendMessage(message.key.remoteJid, {
              text: `✅ *Anti-Delete Enabled*\n\nDeleted messages will be sent to your DM.`,
            });
          } else if (option === "off") {
            antiDeleteEnabled = false;
            messageCache.clear();
            saveData();
            await sock.sendMessage(message.key.remoteJid, {
              text: `❌ *Anti-Delete Disabled*`,
            });
          } else {
            await sock.sendMessage(message.key.remoteJid, {
              text: `*Anti-Delete Status:* ${antiDeleteEnabled ? 'ON ✅' : 'OFF ❌'}\n\n*Usage:*\n.antidel on - Enable\n.antidel off - Disable\n\n_Deleted messages from groups & DMs will be sent to your DM._`,
            });
          }
          return;
        }

        if (command === "live") {
          const symbol = args[0];
          if (!symbol) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Usage: .live [symbol]\n\nExamples:\n.live btc\n.live eth\n.live sol\n.live coai",
            });
            return;
          }

          await sock.sendMessage(message.key.remoteJid, {
            react: { text: "⏳", key: message.key },
          });

          const data = await fetchCryptoPrice(symbol);

          if (!data) {
            const upperSym = symbol.toUpperCase();

            await sock.sendMessage(message.key.remoteJid, {
              text: `Could not find data for *${upperSym}*\n\nTips:\n- Check if the symbol/name is correct\n- Try the full token name (e.g. "pepe" instead of abbreviation)\n- Try pasting a contract address\n\nExamples: .live btc, .live pepe, .live coai`,
            });
            return;
          }

          const price = parseFloat(data.lastPrice).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 8
          });
          const change24h = parseFloat(data.priceChangePercent).toFixed(2);
          const volume = parseFloat(data.volume).toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
          });
          const marketCap = parseFloat(data.marketCap).toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
          });
          const changeLabel = change24h >= 0 ? "UP" : "DOWN";
          const changeSign = change24h >= 0 ? "+" : "";
          const nameStr = data.name ? ` (${data.name})` : '';
          const chainStr = data.chain ? `\nChain: ${data.chain}` : '';
          const dexStr = data.dex ? `\nDEX: ${data.dex}` : '';
          const linkStr = data.pairUrl ? `\n\n🔗 ${data.pairUrl}` : '';

          await sock.sendMessage(message.key.remoteJid, {
            text: `${data.symbol}${nameStr} Live Price\n\nPrice: $${price}\n${changeLabel} 24h Change: ${changeSign}${change24h}%\n\n24h Stats:\nVolume: $${volume}\nMarket Cap: $${marketCap}${chainStr}${dexStr}\n\nUpdated: ${new Date().toLocaleTimeString()}\nSource: ${data.source || 'DexScreener'}${linkStr}`,
          });

          await sock.sendMessage(message.key.remoteJid, {
            react: { text: "✅", key: message.key },
          });
          return;
        }

        if (command === "public") {
          if (!isOwner) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "Owner only.",
            });
            return;
          }
          botMode = "public";
          await sock.sendMessage(message.key.remoteJid, {
            text: "✅ Bot set to public.",
          });
          logger.info('Bot mode changed to PUBLIC');
          return;
        }

        if (command === "private") {
          if (!isOwner) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Owner only.",
            });
            return;
          }
          botMode = "private";
          await sock.sendMessage(message.key.remoteJid, {
            text: "Bot set to private.",
          });
          logger.info('Bot mode changed to PRIVATE');
          return;
        }

        if ((command === "tagall" || command === "tag" || command === "t") && canUseBot) {
          let mentions = [];
          let tagText = "Group Members:\n\n";

          for (let member of groupMetadata.participants) {
            mentions.push(member.id);
            tagText += `@${member.id.split("@")[0]}\n`;
          }

          await sock.sendMessage(
            message.key.remoteJid,
            { text: tagText, mentions },
            { quoted: message }
          );
          return;
        }

        if (command === "hidetag" && canUseBot) {
          try {
            const tagMsg = args.join(' ').trim() || '.';
            let mentions = [];
            for (let member of groupMetadata.participants) {
              mentions.push(member.id);
            }

            // Delete the original .hidetag command message
            try {
              await sock.sendMessage(message.key.remoteJid, { delete: message.key });
            } catch (e) {}

            await sock.sendMessage(message.key.remoteJid, {
              text: tagMsg,
              mentions,
            });
          } catch (err) {
            logger.error({ error: err.message }, 'Hidetag error');
          }
          return;
        }

        if (command === "taggg" && canUseBot) {
          try {
            const tagMsg = args.join(' ').trim() || 'Hello everyone!';
            let mentions = [];
            for (let member of groupMetadata.participants) {
              mentions.push(member.id);
            }

            // Delete the original .taggg command message
            try {
              await sock.sendMessage(message.key.remoteJid, { delete: message.key });
            } catch (e) {}

            // Send the text with silent mentions
            await sock.sendMessage(message.key.remoteJid, {
              text: tagMsg,
              mentions,
            });
          } catch (err) {
            logger.error({ error: err.message }, 'Taggg error');
          }
          return;
        }

        // This check is now redundant as we handle it earlier
        // Removed duplicate check

        if (command === "setsticker" && canUseBot) {
          const cmdName = args[0]?.toLowerCase();
          const sticker = message.message.extendedTextMessage?.contextInfo
            ?.quotedMessage?.stickerMessage;

          if (!sticker || !cmdName) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Reply to a sticker with .setsticker [command]",
            });
            return;
          }

          if (!["kick", "open", "lock", "vv", "hidetag", "pp", "sticker", "save"].includes(cmdName)) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Commands: kick, open, lock, vv, hidetag, pp, sticker, save",
            });
            return;
          }

          if (cmdName === "sticker") {
            const stickerHashValue = sticker.fileSha256 ? Buffer.from(sticker.fileSha256).toString('base64') : null;
            stickerCommands[cmdName] = { type: "sticker_converter", hash: stickerHashValue };
            saveData(); // Persist to JSON
            await sock.sendMessage(message.key.remoteJid, {
              text: `✅ Sticker set to *${cmdName.toUpperCase()}*.`,
            });
            return;
          }

          const stickerHash = sticker.fileSha256 ? Buffer.from(sticker.fileSha256).toString('base64') : null;
          stickerCommands[cmdName] = stickerHash || true;
          saveData(); // Persist to JSON

          await sock.sendMessage(message.key.remoteJid, { text: `✅ Sticker set to *${cmdName.toUpperCase()}*.` });
          logger.info({ 
            command: cmdName, 
            hash: stickerHash,
            hashLength: stickerHash?.length,
            savedValue: stickerCommands[cmdName],
            allCommands: JSON.stringify(stickerCommands)
          }, 'SETSTICKER: Command saved successfully');
          return;
        }

        // ============================================
        // Take Sticker Command (save sticker with custom name)
        // ============================================
        if (command === "take" && canUseBot) {
          try {
            const quoted = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted?.stickerMessage) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "❌ Reply to a sticker.",
              });
              return;
            }
            
            // Download the sticker
            const stream = await downloadContentFromMessage(quoted.stickerMessage, 'sticker');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
              buffer = Buffer.concat([buffer, chunk]);
            }
            
            // Send back as sticker
            await sock.sendMessage(message.key.remoteJid, {
              sticker: buffer,
            });

            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "✅", key: message.key },
            });

            setTimeout(async () => {
              try {
                await sock.sendMessage(message.key.remoteJid, {
                  react: { text: "", key: message.key },
                });
              } catch (err) {}
            }, 1000);

            logger.info('Sticker taken successfully');
          } catch (err) {
            logger.error({ error: err.message }, 'Take sticker error');
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Failed to take sticker.",
            });
          }
          return;
        }

        if (command === "sticker" && canUseBot) {
          try {
            const quoted = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "❌ Reply to an image or video.",
              });
              return;
            }

            const imageMsg = quoted?.imageMessage;
            const videoMsg = quoted?.videoMessage;
            
            if (!imageMsg && !videoMsg) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "❌ Image or video only.",
              });
              return;
            }

            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "⏳", key: message.key },
            });

            // Get custom sticker name from args
            const stickerName = args.join(' ').trim() || 'LUCA Bot';
            
            let stickerBuffer;
            
            if (imageMsg) {
              const stream = await downloadContentFromMessage(imageMsg, 'image');
              let buffer = Buffer.from([]);
              for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
              }
              stickerBuffer = await convertToSticker(buffer);
            } else if (videoMsg) {
              const stream = await downloadContentFromMessage(videoMsg, 'video');
              let buffer = Buffer.from([]);
              for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
              }
              stickerBuffer = await convertVideoToSticker(buffer);
            }
            
            if (!stickerBuffer) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "❌ Failed to create sticker.",
              });
              return;
            }

            await sock.sendMessage(message.key.remoteJid, {
              sticker: stickerBuffer,
            });

            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "✅", key: message.key },
            });
            logger.info({ stickerName }, 'Sticker created successfully');
          } catch (err) {
            logger.error({ error: err.message, stack: err.stack }, 'Sticker error');
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Failed to create sticker.",
            });
          }
          return;
        }

if (command === "vv" && canUseBot) {
          try {
            const quoted = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "❌ Reply to a view-once message.",
              });
              return;
            }

            const viewOnceMsg = await extractViewOnceMedia(quoted);
            if (!viewOnceMsg) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "❌ Not a view-once message.",
              });
              return;
            }

            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "⏳", key: message.key },
            });

            const media = await downloadViewOnceMedia(viewOnceMsg);
            if (!media || !media.mediaData) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "❌ Download failed. Try again.",
              });
              return;
            }

            // Send the media back as a regular message to the current chat
            const sendOptions = {
              caption: media.caption || '',
            };

            if (media.mediaType === "image") {
              sendOptions.image = media.mediaData;
            } else if (media.mediaType === "video") {
              sendOptions.video = media.mediaData;
            }

            await sock.sendMessage(message.key.remoteJid, sendOptions, {
              quoted: message,
            });

            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "✅", key: message.key },
            });

          } catch (error) {
            logger.error({ error: error.message, stack: error.stack }, 'VV command error');
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Error processing view-once.",
            });
          }
          return;
        }

        if (command === "save" && canUseBot) {
          try {
            // Check for quoted message (reply to a status/image/video)
            let quoted = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
            let imageMsg = quoted?.imageMessage;
            let videoMsg = quoted?.videoMessage;
            
            // Also check if the status is inside a viewOnce wrapper
            if (!imageMsg && !videoMsg && quoted?.viewOnceMessage) {
              const inner = quoted.viewOnceMessage.message || quoted.viewOnceMessage;
              imageMsg = inner?.imageMessage;
              videoMsg = inner?.videoMessage;
              quoted = inner;
            }
            if (!imageMsg && !videoMsg && quoted?.viewOnceMessageV2) {
              const inner = quoted.viewOnceMessageV2.message;
              imageMsg = inner?.imageMessage;
              videoMsg = inner?.videoMessage;
              quoted = inner;
            }

            // If replying didn't work, check if the message itself is an image/video with caption \".save\"
            if (!imageMsg && !videoMsg) {
              imageMsg = message.message.imageMessage;
              videoMsg = message.message.videoMessage;
            }

            if (!imageMsg && !videoMsg) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "❌ Reply to a status/image/video with .save\\n\\nOr send .save as caption on an image/video.",
              });
              return;
            }

            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "⏳", key: message.key },
            });

            // Download the media
            let mediaData = null;
            let mediaType = null;
            let caption = "";

            try {
              if (imageMsg) {
                const stream = await downloadContentFromMessage(imageMsg, 'image');
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                  buffer = Buffer.concat([buffer, chunk]);
                }
                mediaData = buffer;
                mediaType = "image";
                caption = imageMsg.caption || "";
              } else if (videoMsg) {
                const stream = await downloadContentFromMessage(videoMsg, 'video');
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                  buffer = Buffer.concat([buffer, chunk]);
                }
                mediaData = buffer;
                mediaType = "video";
                caption = videoMsg.caption || "";
              }
            } catch (dlErr) {
              logger.error({ error: dlErr.message }, 'Save download via stream failed, trying downloadMediaMessage');
              // Fallback: try downloadMediaMessage on the original message
              try {
                const buffer = await downloadMediaMessage(message, 'buffer', {});
                if (buffer) {
                  mediaData = buffer;
                  mediaType = imageMsg ? "image" : "video";
                  caption = (imageMsg || videoMsg)?.caption || "";
                }
              } catch (dlErr2) {
                logger.error({ error: dlErr2.message }, 'Save fallback download also failed');
              }
            }

            if (!mediaData) {
              await sock.sendMessage(message.key.remoteJid, {
                react: { text: "❌", key: message.key },
              });
              await sock.sendMessage(message.key.remoteJid, {
                text: "❌ Download failed. The status may have expired.",
              });
              return;
            }

            // Get sender's JID for DM
            const senderJid = normalizeJid(sender);

            // Send the media to user's DM
            const sendOptions = {
              caption: caption || '',
            };

            if (mediaType === "image") {
              sendOptions.image = mediaData;
            } else if (mediaType === "video") {
              sendOptions.video = mediaData;
            }

            await sock.sendMessage(senderJid, sendOptions);

            // Send success reaction in group
            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "✅", key: message.key },
            });

            // Notify in group
            await sock.sendMessage(message.key.remoteJid, {
              text: `✅ Sent to your DM.`,
            }, { quoted: message });

            logger.info({ sender: senderJid, mediaType: mediaType }, 'Status saved');

          } catch (error) {
            logger.error({ error: error.message, stack: error.stack }, 'Save command error');
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Failed to save.",
            });
          }
          return;
        }

        // ============================================
        // AFK Command (Group)
        // ============================================
        if (command === "afk" && canUseBot) {
          const reason = args.join(' ').trim() || 'No reason given';
          
          afkUsers[sender] = {
            reason: reason,
            time: Date.now()
          };
          saveData();
          
          await sock.sendMessage(message.key.remoteJid, {
            text: `\uD83D\uDCA4 *@${sender.split('@')[0]} is now AFK*\n\n\uD83D\uDCDD Reason: ${reason}`,
            mentions: [sender]
          });
          return;
        }

        // ============================================
        // Sticker to Image Command (Group)
        // ============================================
        if (command === "toimg" && canUseBot) {
          try {
            const quoted = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted?.stickerMessage) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "\u274C Reply to a sticker to convert it to an image.",
              });
              return;
            }

            // Check if it's an animated sticker
            if (quoted.stickerMessage.isAnimated) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "\u274C Animated stickers are not supported. Only static stickers can be converted.",
              });
              return;
            }

            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "\u23F3", key: message.key },
            });

            // Download the sticker
            const stream = await downloadContentFromMessage(quoted.stickerMessage, 'sticker');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
              buffer = Buffer.concat([buffer, chunk]);
            }

            // Convert WebP sticker to PNG
            const imageBuffer = await sharp(buffer).png().toBuffer();

            await sock.sendMessage(message.key.remoteJid, {
              image: imageBuffer,
              caption: '\uD83D\uDDBC\uFE0F Sticker converted to image!',
            });

            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "\u2705", key: message.key },
            });
          } catch (err) {
            logger.error({ error: err.message }, 'ToImg error');
            await sock.sendMessage(message.key.remoteJid, {
              text: "\u274C Failed to convert sticker to image.",
            });
          }
          return;
        }

        // ============================================
        // Video/Audio to MP3 Command (Group)
        // ============================================
        if (command === "tomp3" && canUseBot) {
          try {
            const quoted = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted?.videoMessage && !quoted?.audioMessage) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "\u274C Reply to a video or audio message to extract audio.",
              });
              return;
            }

            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "\u23F3", key: message.key },
            });

            let buffer = Buffer.from([]);
            let mediaType;

            if (quoted.videoMessage) {
              const stream = await downloadContentFromMessage(quoted.videoMessage, 'video');
              for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
              }
              mediaType = 'video';
            } else if (quoted.audioMessage) {
              const stream = await downloadContentFromMessage(quoted.audioMessage, 'audio');
              for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
              }
              mediaType = 'audio';
            }

            // Use ffmpeg to extract audio as mp3
            const { execSync } = require('child_process');
            const tempDir = path.join(__dirname, 'temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            const tempInput = path.join(tempDir, `input_${Date.now()}.${mediaType === 'video' ? 'mp4' : 'ogg'}`);
            const tempOutput = path.join(tempDir, `output_${Date.now()}.mp3`);

            fs.writeFileSync(tempInput, buffer);
            execSync(`ffmpeg -i "${tempInput}" -vn -ab 128k -ar 44100 -y "${tempOutput}"`, { stdio: 'pipe' });

            const mp3Buffer = fs.readFileSync(tempOutput);

            // Clean up temp files
            fs.unlinkSync(tempInput);
            fs.unlinkSync(tempOutput);

            await sock.sendMessage(message.key.remoteJid, {
              audio: mp3Buffer,
              mimetype: 'audio/mpeg',
              ptt: false,
            });

            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "\u2705", key: message.key },
            });
          } catch (err) {
            logger.error({ error: err.message }, 'ToMP3 error');
            await sock.sendMessage(message.key.remoteJid, {
              text: "\u274C Failed to convert to MP3. Make sure ffmpeg is installed.",
            });
          }
          return;
        }

        if (command === "play" && canUseBot) {
          await playSongCommand(sock, message, args, logger);
          return;
        }

        // ============================================
        // TikTok Video Downloader
        // ============================================
        if ((command === "tt" || command === "tiktok") && canUseBot) {
          let tiktokUrl = args.join(' ').trim();
          
          // Check if replying to a message with a TikTok URL
          if (!tiktokUrl) {
            const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quotedMsg) {
              const quotedText = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || '';
              const urlMatch = quotedText.match(/https?:\/\/(www\.)?(tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)[^\s]*/i);
              if (urlMatch) {
                tiktokUrl = urlMatch[0];
              }
            }
          }
          
          if (!tiktokUrl || !tiktokUrl.match(/tiktok\.com/i)) {
            await sock.sendMessage(message.key.remoteJid, {
              text: `❌ *Usage:* .tt [tiktok url]\n\nOr reply to a TikTok link with .tt`,
            });
            return;
          }
          
          // React with timer while processing
          await sock.sendMessage(message.key.remoteJid, {
            react: { text: "⏳", key: message.key },
          });
          
          try {
            const apiUrl = `https://api.idledeveloper.tech/api/tiktok?url=${encodeURIComponent(tiktokUrl)}`;
            const response = await axios.get(apiUrl, {
              timeout: 30000,
              headers: { 'X-API-Key': 'tiktok_e176b399ccea758d1aa6bbc8d29533dde9fbcd96d827460e' }
            });
            
            if (response.data && response.data.success && response.data.data) {
              const data = response.data.data;
              const videoUrl = data.video?.noWatermark || data.video?.hdNoWatermark || data.video?.watermark || data.downloadUrls?.noWatermark;
              
              if (videoUrl) {
                // Change reaction to success
                await sock.sendMessage(message.key.remoteJid, {
                  react: { text: "✅", key: message.key },
                });
                
                // Build caption with stats
                let caption = `🎵 *TikTok Download*\n\n`;
                if (data.author) caption += `👤 *Author:* ${data.author || data.authorUsername || 'Unknown'}\n`;
                if (data.description) caption += `📝 ${data.description}\n`;
                if (data.stats) {
                  caption += `\n❤️ ${data.stats.likes?.toLocaleString() || 0} • 💬 ${data.stats.comments?.toLocaleString() || 0} • 🔄 ${data.stats.shares?.toLocaleString() || 0}`;
                }
                
                // Send the video
                await sock.sendMessage(message.key.remoteJid, {
                  video: { url: videoUrl },
                  caption: caption,
                });
              } else {
                throw new Error('No video URL found');
              }
            } else {
              throw new Error(response.data?.message || 'API error');
            }
          } catch (error) {
            logger.error({ error: error.message }, 'TikTok download error');
            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "❌", key: message.key },
            });
            await sock.sendMessage(message.key.remoteJid, {
              text: `❌ Failed to download TikTok video.\n\n_Try again or check if the URL is valid._`,
            });
          }
          return;
        }

        // STICKER COMMAND DETECTION
        // Use canUseAsOwner OR canUseBot OR fromMe to ensure owner can use stickers in private mode
        const canUseStickerCmd = canUseAsOwner || canUseBot || message.key.fromMe;
        
        // Verbose debug logging disabled
        // logger.info({ 
        //   hasStickerMessage: !!message.message.stickerMessage,
        //   text: text,
        //   textEmpty: !text,
        //   canUseBot: canUseBot,
        //   canUseAsOwner: canUseAsOwner,
        //   fromMe: message.key.fromMe,
        //   canUseStickerCmd: canUseStickerCmd,
        //   willProcess: !!(message.message.stickerMessage && !text && canUseStickerCmd)
        // }, 'STICKER DEBUG: Pre-check');

        if (message.message.stickerMessage && !text && canUseStickerCmd) {
          const stickerHash = message.message.stickerMessage.fileSha256 ? Buffer.from(message.message.stickerMessage.fileSha256).toString('base64') : null;
          
          // Debug logging disabled
          // logger.info({ 
          //   stickerDetected: true, 
          //   receivedHash: stickerHash,
          //   hashLength: stickerHash?.length,
          //   savedCommandsCount: Object.keys(stickerCommands).length,
          //   savedCommands: JSON.stringify(stickerCommands),
          //   group: message.key.remoteJid 
          // }, 'STICKER: Detected sticker message');

          // if (Object.keys(stickerCommands).length === 0) {
          //   logger.warn('STICKER: No saved sticker commands found!');
          // }

          for (const [cmdName, hash] of Object.entries(stickerCommands)) {
            const hashMatch = hash === stickerHash;
            const isTrue = hash === true;
            const objMatch = typeof hash === 'object' && hash.hash === stickerHash;
            
            // Debug logging disabled
            // logger.info({ 
            //   cmdName, 
            //   hashMatch, 
            //   isTrue, 
            //   objMatch,
            //   savedHashType: typeof hash,
            //   savedHash: typeof hash === 'object' ? hash.hash : hash, 
            //   savedHashLength: (typeof hash === 'object' ? hash.hash : hash)?.length,
            //   receivedHash: stickerHash,
            //   receivedHashLength: stickerHash?.length,
            //   exactMatch: (typeof hash === 'object' ? hash.hash : hash) === stickerHash
            // }, 'STICKER: Checking command match');
            
            if (hashMatch || isTrue || objMatch) {
              logger.info({ command: cmdName }, 'STICKER: Command triggered!');

              if (cmdName === "vv") {
                try {
                  const contextInfo = message.message.stickerMessage?.contextInfo;
                  if (!contextInfo || !contextInfo.quotedMessage) return;

                  const quoted = contextInfo.quotedMessage;
                  const viewOnceMsg = await extractViewOnceMedia(quoted);
                  if (!viewOnceMsg) return;

                  const media = await downloadViewOnceMedia(viewOnceMsg);
                  if (!media) return;

                  const ownerJid = BOT_OWNER + "@s.whatsapp.net";
                  if (media.mediaType === "image") {
                    await sock.sendMessage(ownerJid, {
                      image: media.mediaData,
                      caption: media.caption || "View-once photo saved (via sticker)",
                    });
                  } else if (media.mediaType === "video") {
                    await sock.sendMessage(ownerJid, {
                      video: media.mediaData,
                      caption: media.caption || "View-once video saved (via sticker)",
                    });
                  }
                } catch (err) {
                  logger.error({ error: err.message }, 'Sticker vv error');
                }
                return;
              } else if (cmdName === "hidetag") {
                try {
                  let mentions = [];
                  for (let member of groupMetadata.participants) {
                    mentions.push(member.id);
                  }

                  // Delete the sticker message that triggered hidetag
                  try {
                    await sock.sendMessage(message.key.remoteJid, { delete: message.key });
                  } catch (e) {}

                  await sock.sendMessage(message.key.remoteJid, {
                    text: '.',
                    mentions,
                  });
                } catch (err) {
                  logger.error({ error: err.message }, 'Sticker hidetag error');
                }
                return;
              } else if (cmdName === "pp") {
                try {
                  const contextInfo = message.message.stickerMessage?.contextInfo;
                  if (!contextInfo || !contextInfo.participant) return;

                  let targetJid = normalizeJid(contextInfo.participant);
                  let ppUrl = null;

                  try {
                    ppUrl = await sock.profilePictureUrl(targetJid, "image");
                  } catch (err1) {
                    try {
                      ppUrl = await sock.profilePictureUrl(targetJid, "display");
                    } catch (err2) {}
                  }

                  if (ppUrl) {
                    await sock.sendMessage(message.key.remoteJid, {
                      image: { url: ppUrl },
                      caption: `Profile: @${targetJid.split("@")[0]}`,
                      mentions: [targetJid]
                    });
                  } else {
                    await sock.sendMessage(message.key.remoteJid, {
                      text: "❌ Profile picture unavailable.",
                    });
                  }
                } catch (err) {
                  logger.error({ error: err.message }, 'Sticker pp error');
                }
                return;
              } else if (cmdName === "sticker") {
                try {
                  const contextInfo = message.message.stickerMessage?.contextInfo;
                  if (!contextInfo?.quotedMessage?.imageMessage) return;

                  const imageMsg = contextInfo.quotedMessage.imageMessage;
                  const stream = await downloadContentFromMessage(imageMsg, 'image');
                  let buffer = Buffer.from([]);
                  for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                  }

                  const stickerBuffer = await convertToSticker(buffer);
                  if (stickerBuffer) {
                    await sock.sendMessage(message.key.remoteJid, {
                      sticker: stickerBuffer,
                    });
                  }
                } catch (err) {
                  logger.error({ error: err.message }, 'Sticker converter error');
                }
                return;
              } else if (cmdName === "save") {
                try {
                  const contextInfo = message.message.stickerMessage?.contextInfo;
                  if (!contextInfo || !contextInfo.quotedMessage) return;

                  const quoted = contextInfo.quotedMessage;
                  const imageMsg = quoted?.imageMessage;
                  const videoMsg = quoted?.videoMessage;

                  if (!imageMsg && !videoMsg) return;

                  // Download the status media
                  const media = await downloadStatusMedia(quoted);
                  if (!media || !media.mediaData) return;

                  // Get sender's JID for DM
                  const senderJid = normalizeJid(sender);

                  // Send the media to user's DM
                  const sendOptions = {
                    caption: `Status saved!\n\n${media.caption ? `Original Caption: ${media.caption}` : 'No caption'}\n\nDownloaded via LUCA Bot (Sticker)`,
                  };

                  if (media.mediaType === "image") {
                    sendOptions.image = media.mediaData;
                  } else if (media.mediaType === "video") {
                    sendOptions.video = media.mediaData;
                  }

                  await sock.sendMessage(senderJid, sendOptions);

                  // Send success reaction
                  await sock.sendMessage(message.key.remoteJid, {
                    react: { text: "OK", key: message.key },
                  });

                  setTimeout(async () => {
                    try {
                      await sock.sendMessage(message.key.remoteJid, {
                        react: { text: "", key: message.key },
                      });
                    } catch (err) {}
                  }, 3000);

                  logger.info({ sender: senderJid }, 'Status saved via sticker');
                } catch (err) {
                  logger.error({ error: err.message }, 'Sticker save error');
                }
                return;
              } else if (isAdmin || isOwner) {
                if (cmdName === "kick") {
                  const contextInfo = message.message.stickerMessage?.contextInfo;
                  const targetJid = contextInfo?.participant;

                  if (targetJid && ownerIsAdmin) {
                    try {
                      await sock.groupParticipantsUpdate(message.key.remoteJid, [targetJid], "remove");
                      await sock.sendMessage(message.key.remoteJid, {
                        react: { text: "OK", key: message.key },
                      });
                    } catch (err) {
                      logger.error({ error: err.message }, 'Sticker kick error');
                    }
                  }
                  return;
                } else if (cmdName === "open") {
                  if (!ownerIsAdmin) return;
                  try {
                    lockedGroups.delete(message.key.remoteJid);
                    await sock.groupSettingUpdate(message.key.remoteJid, "not_announcement");
                    await sock.sendMessage(message.key.remoteJid, {
                      react: { text: "✅", key: message.key },
                    });
                  } catch (err) {
                    logger.error({ error: err.message }, 'Sticker open error');
                  }
                  return;
                } else if (cmdName === "lock") {
                  if (!ownerIsAdmin) return;
                  try {
                    lockedGroups.add(message.key.remoteJid);
                    await sock.groupSettingUpdate(message.key.remoteJid, "announcement");
                    await sock.sendMessage(message.key.remoteJid, {
                      react: { text: "✅", key: message.key },
                    });
                  } catch (err) {
                    logger.error({ error: err.message }, 'Sticker lock error');
                  }
                  return;
                }
              }
            }
          }
          return;
        }

        if (!isAdmin && !canUseAsOwner) return;

        if (command === "lock" || command === "close" || command === "mute") {
          if (!ownerIsAdmin) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Bot needs admin.",
            });
            return;
          }
          try {
            lockedGroups.add(message.key.remoteJid);
            await sock.groupSettingUpdate(message.key.remoteJid, "announcement");
            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "✅", key: message.key },
            });
            logger.info({ group: message.key.remoteJid }, 'Group locked');
          } catch (err) {
            logger.error({ error: err.message }, 'Lock error');
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Failed to lock group: " + err.message,
            });
          }
          return;
        }

        if (command === "open" || command === "unmute") {
          if (!ownerIsAdmin) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Bot needs admin.",
            });
            return;
          }
          try {
            lockedGroups.delete(message.key.remoteJid);
            await sock.groupSettingUpdate(message.key.remoteJid, "not_announcement");
            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "✅", key: message.key },
            });
            logger.info({ group: message.key.remoteJid }, 'Group opened');
          } catch (err) {
            logger.error({ error: err.message }, 'Open error');
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Failed to open group: " + err.message,
            });
          }
          return;
        }
        if (command === "nightmode") {
  if (!ownerIsAdmin) {
    await sock.sendMessage(message.key.remoteJid, {
      text: "❌ Bot needs admin.",
    });
    return;
  }

const option = args[0]?.toLowerCase();
if (option === "on") {
  if (!nightModeGroups.includes(message.key.remoteJid)) {
    nightModeGroups.push(message.key.remoteJid);
    saveData();

    logger.info(
      { groups: nightModeGroups },
      "Night Mode groups saved"
    );
  }

  await sock.sendMessage(message.key.remoteJid, {
    text: "🌙 Night Mode enabled for this group.",
  });

  return;
}

if (option === "off") {
  const index = nightModeGroups.indexOf(message.key.remoteJid);

  if (index !== -1) {
    nightModeGroups.splice(index, 1);
    saveData();

    logger.info(
      { groups: nightModeGroups },
      "Night Mode groups updated"
    );
  }

  await sock.sendMessage(message.key.remoteJid, {
    text: "☀️ Night Mode disabled for this group.",
  });

  return;
}
       }
        if (command === "trackactivity") {
  if (!ownerIsAdmin) {
    await sock.sendMessage(message.key.remoteJid, {
      text: "❌ Bot needs admin.",
    });
    return;
  }

  const option = args[0]?.toLowerCase();
  const groupId = message.key.remoteJid;

  if (option === "on") {
    activityTracking[groupId] = true;
    saveData();

    logger.info(
      { groupId },
      "Activity tracking enabled"
    );

    await sock.sendMessage(groupId, {
      text: "📊 Activity tracking has been enabled for this group.",
    });
    return;
  }

  if (option === "off") {
    delete activityTracking[groupId];
    saveData();

    logger.info(
      { groupId },
      "Activity tracking disabled"
    );

    await sock.sendMessage(groupId, {
      text: "📊 Activity tracking has been disabled for this group.",
    });
    return;
  }

  if (option === "status") {
    const enabled = !!activityTracking[groupId];

    await sock.sendMessage(groupId, {
      text: `📊 Activity Tracking: ${enabled ? "✅ Enabled" : "❌ Disabled"}`,
    });
    return;
  }

  await sock.sendMessage(groupId, {
    text:
      "📊 *Activity Tracking*\n\n" +
      "`.trackactivity on` - Enable\n" +
      "`.trackactivity off` - Disable\n" +
      "`.trackactivity status` - Check status",
  });
  return;
        }
        // ============================================
// Kick Command
// Usage: .kick @user
//        .kick (reply to user's message)
// ============================================
if (command === "kick") {
  const groupId = message.key.remoteJid;

  // Group only
  if (!groupId?.endsWith("@g.us")) {
    await sock.sendMessage(groupId, {
      text: "❌ This command can only be used in groups.",
    });
    return;
  }

  // Admin / owner permission
  if (!isAdmin && !canUseAsOwner) {
    await sock.sendMessage(groupId, {
      text: "❌ Admins only.",
    });
    return;
  }

  let mentionedJid = null;

  // Get @mention
  const mentionedJids =
    message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

  if (mentionedJids.length > 0) {
    mentionedJid = mentionedJids[0];
  }

  // Get replied participant if no mention
  if (!mentionedJid) {
    const contextInfo =
      message.message?.extendedTextMessage?.contextInfo;

    if (contextInfo?.participant) {
      mentionedJid = contextInfo.participant;
    }
  }

  if (!mentionedJid) {
    await sock.sendMessage(groupId, {
      text:
        "❌ Please mention or reply to the person you want to kick.\n\n" +
        "Usage:\n" +
        "• .kick @user\n" +
        "• Reply to a message with .kick",
    });
    return;
  }

  try {
    // Get fresh group participant list
    const metadata = await sock.groupMetadata(groupId);
    const participants = metadata.participants || [];

    // Find the actual WhatsApp participant
    const targetParticipant = participants.find((p) => {
      if (!p?.id) return false;

      // Exact match
      if (p.id === mentionedJid) return true;

      // Normalized match
      if (normalizeJid(p.id) === normalizeJid(mentionedJid)) {
        return true;
      }

      // Match alternate JID if WhatsApp supplied one
      if (p.lid && p.lid === mentionedJid) {
        return true;
      }

      if (p.phoneNumber && p.phoneNumber === mentionedJid) {
        return true;
      }

      return false;
    });

    if (!targetParticipant) {
      await sock.sendMessage(groupId, {
        text:
          "❌ I couldn't identify that member in the group.\n\n" +
          "Try mentioning the person again.",
      });

      logger.warn(
        {
          mentionedJid,
          participantCount: participants.length,
        },
        "Kick target not found in group participants"
      );

      return;
    }

    // IMPORTANT:
    // Use the actual participant ID returned by WhatsApp.
    const targetJid = targetParticipant.id;

    // Don't kick the bot
    if (
      targetJid === sock.user?.id ||
      normalizeJid(targetJid) === normalizeJid(sock.user?.id)
    ) {
      await sock.sendMessage(groupId, {
        text: "😂 I can't kick myself.",
      });
      return;
    }

    // Don't kick the command sender
    if (
      targetJid === sender ||
      normalizeJid(targetJid) === normalizeJid(sender)
    ) {
      await sock.sendMessage(groupId, {
        text: "😂 You can't kick yourself.",
      });
      return;
    }

    logger.info(
      {
        mentionedJid,
        resolvedJid: targetJid,
        targetAdmin: targetParticipant.admin || null,
      },
      "Kick target resolved"
    );

    // Remove using WhatsApp's actual participant ID
    await sock.groupParticipantsUpdate(
      groupId,
      [targetJid],
      "remove"
    );

    await sock.sendMessage(groupId, {
      text: `👢 @${targetJid.split("@")[0]} has been kicked from the group.`,
      mentions: [targetJid],
    });

    logger.info(
      {
        groupId,
        target: targetJid,
      },
      "User kicked using .kick command"
    );

  } catch (err) {
    logger.error(
      {
        error: err.message,
        target: mentionedJid,
      },
      "Kick command failed"
    );

    await sock.sendMessage(groupId, {
      text:
        `❌ Failed to kick the selected member.\n\n` +
        `Error: ${err.message}\n\n` +
        `Make sure the bot is an admin and the target can be removed.`,
    });
  }

  return;
}
        if (command === "getpp") {
          let targetJid = null;

          const contextInfo =
            message.message?.extendedTextMessage?.contextInfo;

          // ============================================
          // 1. Reply target
          // ============================================
          if (contextInfo?.participant) {
            targetJid = contextInfo.participant;
          }

          // ============================================
          // 2. Mention target
          // ============================================
          const mentionedJids = contextInfo?.mentionedJid || [];

          if (!targetJid && mentionedJids.length > 0) {
            const mentionedJid = mentionedJids[0];

            if (isGroup) {
              try {
                const groupMetadata = await sock.groupMetadata(
                  message.key.remoteJid
                );

                const participant = groupMetadata.participants?.find((p) => {
                  if (!p?.id) return false;

                  if (p.id === mentionedJid) return true;
                  if (p.lid && p.lid === mentionedJid) return true;
                  if (p.phoneNumber && p.phoneNumber === mentionedJid) {
                    return true;
                  }

                  return false;
                });

                if (participant) {
                  targetJid = participant.id;
                }
              } catch (err) {
                logger.error(
                  { error: err.message },
                  "Failed to resolve getpp participant"
                );
              }
            } else {
              targetJid = mentionedJid;
            }
          }

          // ============================================
          // 3. Number supplied
          // ============================================
          if (!targetJid && args[0]) {
            const num = args[0].replace(/[^0-9]/g, '');

            if (num.length >= 10) {
              targetJid = `${num}@s.whatsapp.net`;
            }
          }

          // ============================================
          // 4. DM fallback
          // ============================================
          if (
            !targetJid &&
            !isGroup &&
            message.key.remoteJid
          ) {
            targetJid = message.key.remoteJid;
          }

          if (!targetJid) {
            await sock.sendMessage(message.key.remoteJid, {
              text:
                "❌ Reply to a message, mention someone, or provide a number.\n\n" +
                "Usage:\n" +
                `• ${PREFIX}getpp @user\n` +
                `• ${PREFIX}getpp 2348012345678\n` +
                `• Reply to a message with ${PREFIX}getpp`
            });
            return;
          }

          try {
            let ppUrl = null;

            // ============================================
            // Use the same PP method as {userpp}
            // ============================================
            try {
              ppUrl = await sock.profilePictureUrl(targetJid, "image");
            } catch (imageErr) {
              try {
                ppUrl = await sock.profilePictureUrl(targetJid, "display");
              } catch (displayErr) {
                logger.info(
                  { target: targetJid },
                  "No profile picture found with image/display lookup"
                );
              }
            }

            if (!ppUrl) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "❌ Profile picture unavailable or hidden by privacy settings."
              });
              return;
            }

            const response = await axios.get(ppUrl, {
              responseType: "arraybuffer",
              timeout: 10000
            });

            const imageBuffer = Buffer.from(response.data);

            await sock.sendMessage(message.key.remoteJid, {
              image: imageBuffer,
              caption: `👤 Profile Picture\n📱 @${targetJid.split("@")[0]}`,
              mentions: [targetJid]
            });

            logger.info(
              { target: targetJid },
              "Profile picture fetched successfully"
            );

          } catch (err) {
            logger.error(
              { target: targetJid, error: err.message },
              "Get PP error"
            );

            await sock.sendMessage(message.key.remoteJid, {
              text:
                "❌ Could not fetch that profile picture.\n\n" +
                "The user may have restricted their profile picture " +
                "or WhatsApp may not have returned the picture."
            });
          }

          return;
        }

        if (command === "warn") {
          let targetJid = null;
          
          // Check for @mentions first
          const mentions = message.message.extendedTextMessage?.contextInfo?.mentionedJid;
          if (mentions && mentions.length > 0) {
            targetJid = mentions[0]; // Use first mentioned user
          } else {
            // Fallback to reply method
            const quoted = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "❌ Reply or mention a user.",
              });
              return;
            }
            targetJid = message.message.extendedTextMessage?.contextInfo?.participant;
          }
          
          if (!targetJid) return;

          const groupId = message.key.remoteJid;
          if (!userWarns[groupId]) userWarns[groupId] = {};
          if (!userWarns[groupId][targetJid]) userWarns[groupId][targetJid] = 0;

          userWarns[groupId][targetJid]++;
          const warnCount = userWarns[groupId][targetJid];
          saveData(); // Persist warnings

          if (warnCount >= 3) {
            // Always try to kick, check for errors
            try {
              await sock.groupParticipantsUpdate(groupId, [targetJid], "remove");
              await sock.sendMessage(groupId, {
                text: `⚠️ @${targetJid.split("@")[0]} kicked (3 warnings).`,
                mentions: [targetJid]
              });
              delete userWarns[groupId][targetJid];
              saveData(); // Save after removing warn count
              logger.info({ target: targetJid }, 'User kicked after 3 warnings');
            } catch (err) {
              logger.error({ error: err.message }, 'Auto-kick error');
              await sock.sendMessage(groupId, {
                text: `⚠️ @${targetJid.split("@")[0]} has 3 warnings. Could not kick - check bot permissions.`,
                mentions: [targetJid]
              });
            }
          } else {
            await sock.sendMessage(groupId, {
              text: `⚠️ Warning ${warnCount}/3 - @${targetJid.split("@")[0]}`,
              mentions: [targetJid]
            });
          }
          return;
        }

        if (command === "unwarn") {
          let targetJid = null;
          
          // Check for @mentions first
          const mentions = message.message.extendedTextMessage?.contextInfo?.mentionedJid;
          if (mentions && mentions.length > 0) {
            targetJid = mentions[0]; // Use first mentioned user
          } else {
            // Fallback to reply method
            const quoted = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "❌ Reply or mention a user.",
              });
              return;
            }
            targetJid = message.message.extendedTextMessage?.contextInfo?.participant;
          }
          
          if (!targetJid) return;

          const groupId = message.key.remoteJid;
          
          if (!userWarns[groupId] || !userWarns[groupId][targetJid]) {
            await sock.sendMessage(message.key.remoteJid, {
              text: `ℹ️ @${targetJid.split("@")[0]} has no warnings.`,
              mentions: [targetJid]
            });
            return;
          }

          const warnCount = userWarns[groupId][targetJid];
          userWarns[groupId][targetJid]--;
          
          if (userWarns[groupId][targetJid] <= 0) {
            delete userWarns[groupId][targetJid];
            await sock.sendMessage(message.key.remoteJid, {
              text: `✅ @${targetJid.split("@")[0]} warnings cleared.`,
              mentions: [targetJid]
            });
          } else {
            await sock.sendMessage(message.key.remoteJid, {
              text: `✅ @${targetJid.split("@")[0]} warning: ${warnCount} → ${userWarns[groupId][targetJid]}`,
              mentions: [targetJid]
            });
          }
          
          saveData(); // Persist warning changes
          logger.info({ target: targetJid, newWarnCount: userWarns[groupId][targetJid] || 0 }, 'Warning removed');
          return;
        }

        if (command === "promote") {
          if (!ownerIsAdmin) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Bot needs admin.",
            });
            return;
          }

          const quoted = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
          if (!quoted) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Reply to a message.",
            });
            return;
          }

          const targetJid = message.message.extendedTextMessage?.contextInfo?.participant;
          if (!targetJid) return;

          try {
            await sock.groupParticipantsUpdate(message.key.remoteJid, [targetJid], "promote");
            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "✅", key: message.key },
            });
            logger.info({ target: targetJid }, 'User promoted');
          } catch (err) {
            logger.error({ error: err.message }, 'Promote error');
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Failed to promote.",
            });
          }
          return;
        }

        if (command === "demote") {
          if (!ownerIsAdmin) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Bot needs admin.",
            });
            return;
          }

          const quoted = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
          if (!quoted) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Reply to a message.",
            });
            return;
          }

          const targetJid = message.message.extendedTextMessage?.contextInfo?.participant;
          if (!targetJid) return;

          try {
            await sock.groupParticipantsUpdate(message.key.remoteJid, [targetJid], "demote");
            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "✅", key: message.key },
            });
            logger.info({ target: targetJid }, 'User demoted');
          } catch (err) {
            logger.error({ error: err.message }, 'Demote error');
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Failed to demote.",
            });
          }
          return;
        }

        if (command === "block") {
          let targetJid;
          if (args.length > 0) {
            const num = args[0].replace(/[^0-9]/g, '');
            if (num) targetJid = `${num}@s.whatsapp.net`;
          } else {
            // Try reply - extract phone number from participant
            const participant = message.message.extendedTextMessage?.contextInfo?.participant;
            if (participant && participant.includes('@s.whatsapp.net')) {
              targetJid = participant;
            } else if (participant) {
              // LID format - can't use for blocking
              const num = participant.split('@')[0].split(':')[0];
              if (/^\d{10,15}$/.test(num)) targetJid = `${num}@s.whatsapp.net`;
            }
          }
          if (!targetJid) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Provide a phone number.\n\nExample: .block 2348012345678",
            });
            return;
          }
          try {
            await sock.updateBlockStatus(targetJid, 'block');
            const displayNum = targetJid.split('@')[0];
            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "✅", key: message.key },
            });
            await sock.sendMessage(message.key.remoteJid, {
              text: `✅ ${displayNum} blocked.`,
            });
            logger.info({ target: targetJid }, 'User blocked via WhatsApp API');
          } catch (err) {
            logger.error({ error: err.message }, 'Block failed');
            await sock.sendMessage(message.key.remoteJid, {
              text: `❌ Failed to block: ${err.message}`,
            });
          }
          return;
        }

        if (command === "unblock") {
          let targetJid;
          if (args.length > 0) {
            const num = args[0].replace(/[^0-9]/g, '');
            if (num) targetJid = `${num}@s.whatsapp.net`;
          } else {
            const participant = message.message.extendedTextMessage?.contextInfo?.participant;
            if (participant && participant.includes('@s.whatsapp.net')) {
              targetJid = participant;
            } else if (participant) {
              const num = participant.split('@')[0].split(':')[0];
              if (/^\d{10,15}$/.test(num)) targetJid = `${num}@s.whatsapp.net`;
            }
          }
          if (!targetJid) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Provide a phone number.\n\nExample: .unblock 2348012345678",
            });
            return;
          }
          try {
            await sock.updateBlockStatus(targetJid, 'unblock');
            const displayNum = targetJid.split('@')[0];
            await sock.sendMessage(message.key.remoteJid, {
              text: `✅ ${displayNum} unblocked.`,
            });
            logger.info({ target: targetJid }, 'User unblocked via WhatsApp API');
          } catch (err) {
            logger.error({ error: err.message }, 'Unblock failed');
            await sock.sendMessage(message.key.remoteJid, {
              text: `❌ Failed to unblock: ${err.message}`,
            });
          }
          return;
        }

        if (command === "antilink") {
          if (!isAdmin && !canUseAsOwner) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Admins only.",
            });
            return;
          }

          const action = args[0]?.toLowerCase();

          if (!action || !['kick', 'warn', 'off'].includes(action)) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Usage: .antilink kick/warn/off\n\n*.antilink kick* - Kick users who send links\n*.antilink warn* - Warn users (3 warnings = kick)\n*.antilink off* - Disable link protection",
            });
            return;
          }

          if (!adminSettings[message.key.remoteJid]) {
            adminSettings[message.key.remoteJid] = {};
          }

          if (action === 'off') {
            adminSettings[message.key.remoteJid].antilink = false;
            saveData();
            await sock.sendMessage(message.key.remoteJid, {
              text: "✅ Antilink disabled.",
            });
          } else {
            adminSettings[message.key.remoteJid].antilink = action;
            saveData();
            await sock.sendMessage(message.key.remoteJid, {
              text: `✅ Antilink set to *${action}* mode.`,
            });
          }
          logger.info({ group: message.key.remoteJid, mode: action }, 'Antilink toggled');
          return;
        }

        // ============================================
        // Anti-Photo Command
        // ============================================
        if (command === "antiphoto") {
          if (!isAdmin && !canUseAsOwner) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Admins only.",
            });
            return;
          }

          const action = args[0]?.toLowerCase();

          if (!action || !["kick", "warn", "off"].includes(action)) {
            const currentStatus = antiPhotoGroups[message.key.remoteJid] || 'off';
            await sock.sendMessage(message.key.remoteJid, {
              text: `📷 *Anti-Photo*\n\nCurrent: *${currentStatus.toUpperCase()}*\n\n*Usage:*\n• .antiphoto kick - Delete & kick sender\n• .antiphoto warn - Delete & warn (3 = kick)\n• .antiphoto off - Disable\n\n_Blocks images & videos (view-once allowed)_`,
            });
            return;
          }

          if (action === "off") {
            delete antiPhotoGroups[message.key.remoteJid];
          } else {
            antiPhotoGroups[message.key.remoteJid] = action;
          }
          saveData();

          await sock.sendMessage(message.key.remoteJid, {
            text: action === "off" ? "❌ Anti-Photo disabled." : `✅ Anti-Photo enabled (*${action}*).`,
          });
          logger.info({ group: message.key.remoteJid, action }, 'Antiphoto toggled');
          return;
        }

        // ============================================
        // Anti-Status Command
        // ============================================
        if (command === "antistatus") {
          if (!isAdmin && !canUseAsOwner) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Admins only.",
            });
            return;
          }

          const action = args[0]?.toLowerCase();

          if (!action || !["kick", "warn", "off"].includes(action)) {
            const currentStatus = antiStatusGroups[message.key.remoteJid] || 'off';
            await sock.sendMessage(message.key.remoteJid, {
              text: `📢 *Anti-Status*\n\nCurrent: *${currentStatus.toUpperCase()}*\n\n*Usage:*\n• .antistatus kick - Delete & kick sender\n• .antistatus warn - Delete & warn (3 = kick)\n• .antistatus off - Disable\n\n_Blocks status mention/tag messages in group_`,
            });
            return;
          }

          if (action === "off") {
            delete antiStatusGroups[message.key.remoteJid];
          } else {
            antiStatusGroups[message.key.remoteJid] = action;
          }
          saveData();

          await sock.sendMessage(message.key.remoteJid, {
            text: action === "off" ? "❌ Anti-Status disabled." : `✅ Anti-Status enabled (*${action}*).`,
          });
          logger.info({ group: message.key.remoteJid, action }, 'Antistatus toggled');
          return;
        }

        // ============================================
        // Anti-Tag Command
        // ============================================
        if (command === "antitag") {
          if (!isAdmin && !canUseAsOwner) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Admins only.",
            });
            return;
          }

          const action = args[0]?.toLowerCase();

          if (!action || !["kick", "warn", "off"].includes(action)) {
            const currentStatus = antiTagGroups[message.key.remoteJid] || 'off';
            await sock.sendMessage(message.key.remoteJid, {
              text: `🏷️ *Anti-Tag*\n\nCurrent: *${currentStatus.toUpperCase()}*\n\n*Usage:*\n• .antitag kick - Delete & kick sender\n• .antitag warn - Delete & warn (3 = kick)\n• .antitag off - Disable\n\n_Blocks users from mass tagging group members_`,
            });
            return;
          }

          if (action === "off") {
            delete antiTagGroups[message.key.remoteJid];
          } else {
            antiTagGroups[message.key.remoteJid] = action;
          }
          saveData();

          await sock.sendMessage(message.key.remoteJid, {
            text: action === "off" ? "❌ Anti-Tag disabled." : `✅ Anti-Tag enabled (*${action}*).`,
          });
          logger.info({ group: message.key.remoteJid, action }, 'Antitag toggled');
          return;
        }

        // ============================================
        // Anti-Spam Command
        // ============================================
        if (command === "antispam") {
          if (!isAdmin && !canUseAsOwner) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Admins only.",
            });
            return;
          }

          const action = args[0]?.toLowerCase();

          if (!action || !["kick", "warn", "off"].includes(action)) {
            const currentStatus = antiSpamGroups[message.key.remoteJid] || 'off';
            await sock.sendMessage(message.key.remoteJid, {
              text: `⚡ *Anti-Spam*\n\nCurrent: *${currentStatus.toUpperCase()}*\n\n*Usage:*\n• .antispam kick - Kick spammers\n• .antispam warn - Warn spammers (3 = kick)\n• .antispam off - Disable\n\n_Detects ${SPAM_THRESHOLD}+ messages within ${SPAM_WINDOW / 1000}s_`,
            });
            return;
          }

          if (action === "off") {
            delete antiSpamGroups[message.key.remoteJid];
          } else {
            antiSpamGroups[message.key.remoteJid] = action;
          }
          saveData();

          await sock.sendMessage(message.key.remoteJid, {
            text: action === "off" ? "❌ Anti-Spam disabled." : `✅ Anti-Spam enabled (*${action}*).`,
          });
          logger.info({ group: message.key.remoteJid, action }, 'Antispam toggled');
          return;
        }

        if (command === "setwelcome") {
          if (!isAdmin && !canUseAsOwner) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Admins only.",
            });
            return;
          }

          // Get the welcome message (everything after .setwelcome)
          const welcomeText = text.split(' ').slice(1).join(' ').trim();

          if (!welcomeText) {
            await sock.sendMessage(message.key.remoteJid, {
              text: `❌ *Usage:* .setwelcome [message]\n\n📝 *Available Placeholders:*\n• {user} - Mention new member\n• {username} - Member's name\n• {groupname} - Group name\n• {desc} - Group description\n• {membercount} - Total members\n• {grppp} - Send with group profile pic\n• {userpp} - Send with new member's profile pic\n\n*Example:*\n.setwelcome {grppp} Welcome {user} to {groupname}! We now have {membercount} members! 🎉\n\n_Note: Use {grppp} or {userpp} anywhere in the message to attach that profile picture to the welcome message._`,
            });
            return;
          }

          // Save the custom welcome message for this group
          customWelcomeMessages[message.key.remoteJid] = welcomeText;
          saveData(); // Persist to JSON

          await sock.sendMessage(message.key.remoteJid, {
            text: `✅ Welcome message set!\n\n_Preview placeholders:_\n• {user} → @mention\n• {username} → username\n• {groupname} → group name\n• {desc} → group description\n• {membercount} → member count\n• {grppp} → group profile picture\n• {userpp} → new member's profile picture`,
          });

          logger.info({
            group: message.key.remoteJid,
            welcomeMessage: welcomeText
          }, 'Custom welcome message set');
          return;
        }

        if (command === "resetwelcome") {
          if (!isAdmin && !canUseAsOwner) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Admins only.",
            });
            return;
          }

          if (!customWelcomeMessages[message.key.remoteJid]) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "ℹ️ Already using default welcome message.",
            });
            return;
          }

          // Remove custom welcome message
          delete customWelcomeMessages[message.key.remoteJid];
          saveData(); // Persist to JSON

          await sock.sendMessage(message.key.remoteJid, {
            text: `Welcome message reset to default.`,
          });

          logger.info({ group: message.key.remoteJid }, 'Welcome message reset to default');
          return;
        }

        if (command === "welcome") {
          if (!isAdmin && !canUseAsOwner) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Admins only.",
            });
            return;
          }

          const action = args[0]?.toLowerCase();

          if (!action || (action !== "on" && action !== "off")) {
            const currentStatus = welcomeEnabled[message.key.remoteJid] ? "ON ✅" : "OFF ❌";
            await sock.sendMessage(message.key.remoteJid, {
              text: `📝 *Welcome Messages*\n\nCurrent status: *${currentStatus}*\n\n*Usage:*\n• .welcome on - Enable welcome messages\n• .welcome off - Disable welcome messages\n• .setwelcome [msg] - Set custom message\n• .resetwelcome - Reset to default message\n\n*Image Placeholders:*\n• {grppp} - Attach group profile pic\n• {userpp} - Attach new member's profile pic`,
            });
            return;
          }

          const isOn = action === "on";
          welcomeEnabled[message.key.remoteJid] = isOn;
          saveData();

          await sock.sendMessage(message.key.remoteJid, {
            text: isOn ? "✅ Welcome messages enabled for this group." : "❌ Welcome messages disabled for this group.",
          });
          logger.info({ group: message.key.remoteJid, enabled: isOn }, 'Welcome toggled');
          return;
        }

        if (command === "goodbye") {
          if (!isAdmin && !canUseAsOwner) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Admins only.",
            });
            return;
          }

          const action = args[0]?.toLowerCase();

          if (!action || (action !== "on" && action !== "off")) {
            const currentStatus = goodbyeEnabled[message.key.remoteJid] ? "ON ✅" : "OFF ❌";
            await sock.sendMessage(message.key.remoteJid, {
              text: `📝 *Goodbye Messages*\n\nCurrent status: *${currentStatus}*\n\n*Usage:*\n• .goodbye on - Enable goodbye messages\n• .goodbye off - Disable goodbye messages\n• .setgoodbye [msg] - Set custom message\n• .resetgoodbye - Reset to default message\n\n*Placeholders:*\n• {user} - @mention\n• {username} - name\n• {groupname} - group name\n• {grppp} / {userpp} - profile pic`,
            });
            return;
          }

          const isOn = action === "on";
          goodbyeEnabled[message.key.remoteJid] = isOn;
          saveData();

          await sock.sendMessage(message.key.remoteJid, {
            text: isOn ? "✅ Goodbye messages enabled for this group." : "❌ Goodbye messages disabled for this group.",
          });
          logger.info({ group: message.key.remoteJid, enabled: isOn }, 'Goodbye toggled');
          return;
        }

        if (command === "setgoodbye") {
          if (!isAdmin && !canUseAsOwner) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Admins only.",
            });
            return;
          }

          const goodbyeText = text.split(' ').slice(1).join(' ').trim();

          if (!goodbyeText) {
            await sock.sendMessage(message.key.remoteJid, {
              text: `❌ *Usage:* .setgoodbye [message]\n\n📝 *Available Placeholders:*\n• {user} - Mention leaving member\n• {username} - Member's name\n• {groupname} - Group name\n• {desc} - Group description\n• {membercount} - Total members\n• {grppp} - Send with group profile pic\n• {userpp} - Send with member's profile pic\n\n*Example:*\n.setgoodbye {userpp} Goodbye {user}! {groupname} now has {membercount} members. 😢\n\n_Note: Use {grppp} or {userpp} anywhere in the message to attach that profile picture to the goodbye message._`,
            });
            return;
          }

          customGoodbyeMessages[message.key.remoteJid] = goodbyeText;
          saveData();

          await sock.sendMessage(message.key.remoteJid, {
            text: `✅ Goodbye message set!\n\n_Preview placeholders:_\n• {user} → @mention\n• {username} → username\n• {groupname} → group name\n• {desc} → group description\n• {membercount} → member count\n• {grppp} → group profile picture\n• {userpp} → member's profile picture`,
          });

          logger.info({
            group: message.key.remoteJid,
            goodbyeMessage: goodbyeText
          }, 'Custom goodbye message set');
          return;
        }

        if (command === "resetgoodbye") {
          if (!isAdmin && !canUseAsOwner) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Admins only.",
            });
            return;
          }

          if (!customGoodbyeMessages[message.key.remoteJid]) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "ℹ️ Already using default goodbye message.",
            });
            return;
          }

          delete customGoodbyeMessages[message.key.remoteJid];
          saveData();

          await sock.sendMessage(message.key.remoteJid, {
            text: `Goodbye message reset to default.`,
          });

          logger.info({ group: message.key.remoteJid }, 'Goodbye message reset to default');
          return;
        }

        if (command === "add") {
          if (!isAdmin && !canUseAsOwner) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Admins only.",
            });
            return;
          }

          const number = args[0]?.replace(/[^0-9]/g, '');
          if (!number) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ *Usage:* .add [number]\n\n*Example:* .add 2347073260074",
            });
            return;
          }

          const userJid = `${number}@s.whatsapp.net`;
          try {
            await sock.groupParticipantsUpdate(message.key.remoteJid, [userJid], 'add');
            await sock.sendMessage(message.key.remoteJid, {
              text: `✅ @${number} has been added to the group.`,
              mentions: [userJid]
            });
          } catch (err) {
            if (err.message?.includes('403') || err.message?.includes('not-authorized')) {
              // Send invite link instead
              try {
                const inviteCode = await sock.groupInviteCode(message.key.remoteJid);
                await sock.sendMessage(userJid, {
                  text: `You've been invited to join a group!\nhttps://chat.whatsapp.com/${inviteCode}`
                });
                await sock.sendMessage(message.key.remoteJid, {
                  text: `⚠️ Couldn't add @${number} directly (privacy settings). An invite link has been sent to their DM.`,
                  mentions: [userJid]
                });
              } catch (invErr) {
                await sock.sendMessage(message.key.remoteJid, {
                  text: `❌ Failed to add @${number}. They may have privacy settings preventing it.`,
                  mentions: [userJid]
                });
              }
            } else {
              await sock.sendMessage(message.key.remoteJid, {
                text: `❌ Failed to add @${number}: ${err.message || 'Unknown error'}`,
                mentions: [userJid]
              });
            }
            logger.error({ error: err.message, number }, 'Add user error');
          }
          return;
        }

        if (command === "anonymous") {
          if (!isAdmin && !canUseAsOwner) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "Admins only.",
            });
            return;
          }

          // Check if there's already an active session for this group
          let existingSessionId = null;
          for (const [sessionId, session] of anonymousSessions.entries()) {
            if (session.groupJid === message.key.remoteJid && session.active) {
              existingSessionId = sessionId;
              break;
            }
          }

          if (existingSessionId) {
            // Session already active, silently return (the session link was already sent)
            return;
          }

          try {
            // Lock the group
            if (ownerIsAdmin) {
              await sock.groupSettingUpdate(message.key.remoteJid, "announcement");
              lockedGroups.add(message.key.remoteJid);
            }

            // Create anonymous session
            const result = await createAnonymousSession(message.key.remoteJid);

            if (!result) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "Failed to create anonymous session. Make sure the web server is running!",
              });
              return;
            }

            const { sessionId, token } = result;
            const sessionLink = `${ANONYMOUS_WEB_URL}/${token}`;

            await sock.sendMessage(message.key.remoteJid, {
              text: `╭━━━━━━━━━━━━━━━━━╮
┃  🎭 *ANONYMOUS GAME* 🎭
╰━━━━━━━━━━━━━━━━━╯

✅ *Anonymous Game Started!*
${ownerIsAdmin ? '🔒 _Group has been locked_' : '⚠️ _Give admin to lock group_'}

━━━━━━━━━━━━━━━━━━━
📨 *Send your anonymous messages to:*
${sessionLink}
━━━━━━━━━━━━━━━━━━━

⏰ _Link will expire after 20 mins of inactivity_

📌 Type *.end* to stop the game`,
            });

            logger.info({ sessionId, groupJid: message.key.remoteJid }, 'Anonymous session started');
          } catch (error) {
            logger.error({ error: error.message }, 'Anonymous command error');
            await sock.sendMessage(message.key.remoteJid, {
              text: "Failed to start anonymous session: " + error.message,
            });
          }
          return;
        }

        // Universal .end command for all games (anonymous, wcg, rtw)
        if (command === "end") {
          if (!isAdmin && !canUseAsOwner) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Admins only.",
            });
            return;
          }

          let gameEnded = false;

          // Check for active anonymous session
          let activeSessionId = null;
          for (const [sessionId, session] of anonymousSessions.entries()) {
            if (session.groupJid === message.key.remoteJid && session.active) {
              activeSessionId = sessionId;
              break;
            }
          }

          if (activeSessionId) {
            try {
              const session = anonymousSessions.get(activeSessionId);
              const messageCount = session?.messageCount || 0;
              
              await endAnonymousSession(activeSessionId);

              if (ownerIsAdmin) {
                await sock.groupSettingUpdate(message.key.remoteJid, "not_announcement");
                lockedGroups.delete(message.key.remoteJid);
              }

              await sock.sendMessage(message.key.remoteJid, {
                text: `*ANONYMOUS*\n\nSession ended\nMessages: ${messageCount}${ownerIsAdmin ? "\nGroup unlocked" : ""}`,
              });
              gameEnded = true;
            } catch (error) {
              logger.error({ error: error.message }, 'End anonymous error');
            }
          }

          // Check for active WCG game
          if (wcgGames.has(message.key.remoteJid)) {
            await forceEndWCGGame(sock, message.key.remoteJid);
            gameEnded = true;
          }

          // Check for active RTW game
          if (rtwGames.has(message.key.remoteJid)) {
            await endRTWGame(sock, message.key.remoteJid, 'stopped');
            gameEnded = true;
          }

          // No active games found
          if (!gameEnded) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ No active games found!",
            });
          }

          return;
        }

        if (command === "rtw") {
          // Check if there's already an active game
          if (rtwGames.has(message.key.remoteJid)) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "RTW game in progress!\nUse .end to stop it.",
            });
            return;
          }

          // Create new game
          createRTWGame(message.key.remoteJid, sender);

          // Start join phase immediately
          await startRTWJoinPhase(sock, message.key.remoteJid);
          logger.info({ groupJid: message.key.remoteJid, owner: sender }, 'RTW game created');
          return;
        }

        // WCG (Word Chain Game) Commands
        if (command === "wcg") {
          // Check if there's already an active game
          if (wcgGames.has(message.key.remoteJid)) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "WCG game in progress!\nUse .end to stop it.",
            });
            return;
          }

          // Create new game
          createWCGGame(message.key.remoteJid, sender);
          
          // Start join phase
          await startWCGJoinPhase(sock, message.key.remoteJid);
          logger.info({ groupJid: message.key.remoteJid, owner: sender }, 'WCG game created');
          return;
        }

        if (command === "wcgstat" || command === "wcgstats") {
          const stats = wcgStats[message.key.remoteJid];
          
          if (!stats || stats.totalGames === 0) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "WCG Stats\nNo games played yet!",
            });
            return;
          }

          // Find all-time winner
          let allTimeWinner = null;
          let maxWins = 0;
          for (const [jid, wins] of Object.entries(stats.wins)) {
            if (wins > maxWins) {
              maxWins = wins;
              allTimeWinner = jid;
            }
          }

          const mentions = [];
          if (allTimeWinner) mentions.push(allTimeWinner);
          if (stats.longestWord.player) mentions.push(stats.longestWord.player);

          await sock.sendMessage(message.key.remoteJid, {
            text: `WCG STATS
Games: ${stats.totalGames}
All-Time Champ: @${allTimeWinner ? allTimeWinner.split('@')[0] : 'N/A'}
Wins: ${maxWins}
Longest Word: "${stats.longestWord.word || 'N/A'}" (${stats.longestWord.length || 0} letters) by @${stats.longestWord.player ? stats.longestWord.player.split('@')[0] : 'N/A'}`,
            mentions
          });
          return;
        }

        if (command === "delete") {
          try {
            const quoted = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "❌ Reply to a message.",
              });
              return;
            }

            const quotedKey = {
              remoteJid: message.key.remoteJid,
              fromMe: false,
              id: message.message.extendedTextMessage?.contextInfo?.stanzaId,
              participant: message.message.extendedTextMessage?.contextInfo?.participant
            };

            await sock.sendMessage(message.key.remoteJid, {
              delete: quotedKey
            });

            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "✅", key: message.key },
            });
            logger.info('Message deleted');
          } catch (err) {
            logger.error({ error: err.message }, 'Delete error');
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Failed to delete.",
            });
          }
          return;
        }

        if (command === "vcf") {
          if (!isOwner) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Owner only.",
            });
            return;
          }

          try {
            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "⏳", key: message.key },
            });

            // Get group metadata with all participants
            const groupMetadata = await sock.groupMetadata(message.key.remoteJid);
            const participants = groupMetadata.participants;

            if (!participants || participants.length === 0) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "❌ No participants found.",
              });
              return;
            }

            // Generate VCF content
            const vcfContent = generateVCF(participants);

            // Create filename with group name and timestamp
            const timestamp = new Date().toISOString().split('T')[0];
            const groupName = groupMetadata.subject.replace(/[^a-z0-9]/gi, '_');
            const filename = `${groupName}_contacts_${timestamp}.vcf`;
            const filepath = path.join(__dirname, filename);

            // Write VCF file
            fs.writeFileSync(filepath, vcfContent, 'utf8');

            // Send the VCF file
            await sock.sendMessage(message.key.remoteJid, {
              document: fs.readFileSync(filepath),
              fileName: filename,
              mimetype: 'text/vcard',
              caption: `Exported ${participants.length} contacts.`
            });

            // Clean up - delete the file after sending
            fs.unlinkSync(filepath);

            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "✅", key: message.key },
            });

            logger.info({
              group: message.key.remoteJid,
              contactCount: participants.length
            }, 'VCF contacts exported');

          } catch (error) {
            logger.error({ error: error.message, stack: error.stack }, 'VCF export error');
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Export failed.",
            });
          }
          return;
        }

        if (command === "sudo" && isOwner) {
          let targetJid = null;
          
          const mentions = message.message.extendedTextMessage?.contextInfo?.mentionedJid;
          if (mentions && mentions.length > 0) {
            targetJid = mentions[0];
          } else {
            const quoted = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quoted) {
              targetJid = message.message.extendedTextMessage?.contextInfo?.participant;
            }
          }
          
          if (!targetJid) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Reply or mention a user.",
            });
            return;
          }
          
          const normalizedTarget = normalizeJid(targetJid);
          const targetNumber = targetJid.split("@")[0].split(":")[0];
          
          if (isSudoUser(targetJid)) {
            await sock.sendMessage(message.key.remoteJid, {
              text: `ℹ️ @${targetNumber} is already a sudo user.`,
              mentions: [targetJid]
            });
            return;
          }
          
          sudoUsers.push(normalizedTarget);
          saveData();
          
          await sock.sendMessage(message.key.remoteJid, {
            text: `✅ @${targetNumber} is now a sudo user.`,
            mentions: [targetJid]
          });
          logger.info({ target: targetJid }, 'Sudo user added');
          return;
        }

        if (command === "delsudo" && isOwner) {
          let targetJid = null;
          
          const mentions = message.message.extendedTextMessage?.contextInfo?.mentionedJid;
          if (mentions && mentions.length > 0) {
            targetJid = mentions[0];
          } else {
            const quoted = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quoted) {
              targetJid = message.message.extendedTextMessage?.contextInfo?.participant;
            }
          }
          
          if (!targetJid) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Reply or mention a user.",
            });
            return;
          }
          
          const targetNumber = targetJid.split("@")[0].split(":")[0];
          
          if (!isSudoUser(targetJid)) {
            await sock.sendMessage(message.key.remoteJid, {
              text: `ℹ️ @${targetNumber} is not a sudo user.`,
              mentions: [targetJid]
            });
            return;
          }
          
          // Remove from sudoUsers
          const index = sudoUsers.findIndex(sudo => {
            let sudoNumber = sudo.split("@")[0].split(":")[0];
            return sudoNumber === targetNumber;
          });
          
          if (index > -1) {
            sudoUsers.splice(index, 1);
            saveData();
          }
          
          await sock.sendMessage(message.key.remoteJid, {
            text: `✅ @${targetNumber} removed from sudo users.`,
            mentions: [targetJid]
          });
          logger.info({ target: targetJid }, 'Sudo user removed');
          return;
        }

        if (command === "listsudo" && isOwner) {
          if (sudoUsers.length === 0) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "ℹ️ No sudo users.",
            });
            return;
          }
          
          let sudoList = "Sudo Users:\n\n";
          const mentions = [];
          
          for (const sudo of sudoUsers) {
            const number = sudo.split("@")[0];
            sudoList += `• @${number}\n`;
            mentions.push(sudo);
          }
          
          await sock.sendMessage(message.key.remoteJid, {
            text: sudoList,
            mentions
          });
          return;
        }

        if (command === "acceptall") {
          if (!isAdmin && !canUseAsOwner) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Admins only.",
            });
            return;
          }
          
          if (!ownerIsAdmin) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Bot needs admin.",
            });
            return;
          }
          
          try {
            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "⏳", key: message.key },
            });
            
            const pendingRequests = await sock.groupRequestParticipantsList(message.key.remoteJid);
            
            if (!pendingRequests || pendingRequests.length === 0) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "ℹ️ No pending requests.",
              });
              return;
            }
            
            let approved = 0;
            for (const request of pendingRequests) {
              try {
                await sock.groupRequestParticipantsUpdate(message.key.remoteJid, [request.jid], "approve");
                approved++;
              } catch (err) {
                logger.error({ error: err.message, user: request.jid }, 'Failed to approve user');
              }
            }
            
            await sock.sendMessage(message.key.remoteJid, {
              text: `✅ Approved ${approved}/${pendingRequests.length} requests.`,
            });
            
            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "✅", key: message.key },
            });
            
            logger.info({ group: message.key.remoteJid, approved, total: pendingRequests.length }, 'Join requests approved');
          } catch (err) {
            logger.error({ error: err.message }, 'Accept all error');
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Failed: " + err.message,
            });
          }
          return;
        }

        if (command === "rejectall") {
          if (!isAdmin && !canUseAsOwner) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Admins only.",
            });
            return;
          }
          
          if (!ownerIsAdmin) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Bot needs admin.",
            });
            return;
          }
          
          try {
            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "⏳", key: message.key },
            });
            
            const pendingRequests = await sock.groupRequestParticipantsList(message.key.remoteJid);
            
            if (!pendingRequests || pendingRequests.length === 0) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "ℹ️ No pending requests.",
              });
              return;
            }
            
            let rejected = 0;
            for (const request of pendingRequests) {
              try {
                await sock.groupRequestParticipantsUpdate(message.key.remoteJid, [request.jid], "reject");
                rejected++;
              } catch (err) {
                logger.error({ error: err.message, user: request.jid }, 'Failed to reject user');
              }
            }
            
            await sock.sendMessage(message.key.remoteJid, {
              text: `✅ Rejected ${rejected}/${pendingRequests.length} requests.`,
            });
            
            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "✅", key: message.key },
            });
            
            logger.info({ group: message.key.remoteJid, rejected, total: pendingRequests.length }, 'Join requests rejected');
          } catch (err) {
            logger.error({ error: err.message }, 'Reject all error');
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Failed: " + err.message,
            });
          }
          return;
        }

        if (command === "left") {
          if (!isOwner) {
            // Non-owner: remove themselves from the group
            try {
              await sock.sendMessage(message.key.remoteJid, {
                text: `👋 @${sender.split('@')[0]} has left the group.`,
                mentions: [sender]
              });
              await sock.groupParticipantsUpdate(message.key.remoteJid, [sender], 'remove');
              logger.info({ group: message.key.remoteJid, user: sender }, 'User left group via .left');
            } catch (err) {
              logger.error({ error: err.message }, 'Leave group error');
              await sock.sendMessage(message.key.remoteJid, {
                text: "❌ Failed to leave. Bot may not be admin.",
              });
            }
          } else {
            // Owner: make the bot leave the group entirely
            try {
              await sock.sendMessage(message.key.remoteJid, {
                text: "Goodbye!",
              });
              await sock.groupLeave(message.key.remoteJid);
              logger.info({ group: message.key.remoteJid }, 'Bot left group');
            } catch (err) {
              logger.error({ error: err.message }, 'Leave group error');
              await sock.sendMessage(message.key.remoteJid, {
                text: "❌ Failed to leave.",
              });
            }
          }
          return;
        }

        // ============================================
        // GET PROFILE PICTURE - DM
        // ============================================
        if (command === "getpp") {
          let targetJid = null;

          const contextInfo =
            message.message?.extendedTextMessage?.contextInfo;

          // 1. Reply target
          if (contextInfo?.participant) {
            targetJid = contextInfo.participant;
          }

          // 2. Mention target
          if (!targetJid && contextInfo?.mentionedJid?.length) {
            targetJid = contextInfo.mentionedJid[0];
          }

          // 3. Number supplied
          if (!targetJid && args[0]) {
            const num = args[0].replace(/[^0-9]/g, '');

            if (num.length >= 10) {
              targetJid = `${num}@s.whatsapp.net`;
            }
          }

          // 4. No target = person we're chatting with
          if (!targetJid) {
            targetJid = message.key.remoteJid;
          }

          try {
            let ppUrl = null;

            // Try Baileys profile-picture API first
            try {
              ppUrl = await sock.profilePictureUrl(
                targetJid,
                "image"
              );
            } catch (e) {
              try {
                ppUrl = await sock.profilePictureUrl(
                  targetJid,
                  "preview"
                );
              } catch (e2) {
                // No profile picture
              }
            }

            if (!ppUrl) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "❌ Profile picture unavailable or hidden by privacy settings."
              });
              return;
            }

            const response = await axios.get(ppUrl, {
              responseType: "arraybuffer",
              timeout: 15000
            });

            const imageBuffer = Buffer.from(response.data);

            await sock.sendMessage(message.key.remoteJid, {
              image: imageBuffer,
              caption: `👤 *Profile Picture*\n📱 @${targetJid.split("@")[0]}`,
              mentions: [targetJid]
            });

            logger.info(
              { target: targetJid },
              "Profile picture fetched from DM"
            );

          } catch (err) {
            logger.error(
              { error: err.message, target: targetJid },
              "DM getpp failed"
            );

            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Could not fetch that profile picture.\n\nIt may be hidden by the user's privacy settings."
            });
          }

          return;
        }

        if (text && text.startsWith(PREFIX)) {
          // Unknown command error
          await sock.sendMessage(message.key.remoteJid, {
            text: `❌ Unknown command. Type ${PREFIX}menu for help.`,
          });
          return;
        }

      } else {
        // DM mode: isOwner/isSudo was already determined above
        const canUseDM = canUseAsOwner || botMode === "public";

        logger.info({
          isOwner,
          isSudo,
          canUseDM,
          botMode,
          sender,
          remoteJid: message.key.remoteJid,
          fromMe: message.key.fromMe,
        }, 'DM mode check');

        if (command === "menu") {
          const channelInfo = {
            contextInfo: {
              forwardingScore: 999,
              isForwarded: true,
              forwardedNewsletterMessageInfo: {
                newsletterJid: '120363407155737368@newsletter',
                newsletterName: 'SILVER BOT',
                serverMessageId: 127
              }
            }
          };
          try {
            const menuImagePath = path.join(__dirname, 'images/menu-image.jpg');
            const menuImage = fs.readFileSync(menuImagePath);
            await sock.sendMessage(message.key.remoteJid, {
              image: menuImage,
              caption: getMenu(),
              ...channelInfo
            });
          } catch (err) {
            logger.debug({ error: err.message }, 'Menu image not found, sending text only');
            await sock.sendMessage(message.key.remoteJid, {
              text: getMenu(),
              ...channelInfo
            });
          }
          return;
        }
        if (command === "prefix") {

  await sock.sendMessage(message.key.remoteJid, {
    text: `╭━━━〔 ⚙ CURRENT PREFIX 〕━━━╮

📌 Current Prefix: *${PREFIX}*

🤖 SILVER BOT

╰━━━━━━━━━━━━━━━━━━━━━━╯`
  });

  return;
        }
if (command === "setprefix") {

  if (!isOwner) {
    await sock.sendMessage(message.key.remoteJid, {
      text: "❌ Only the bot owner can change the prefix."
    });
    return;
  }

  const newPrefix = args[0];

  if (!newPrefix) {
    await sock.sendMessage(message.key.remoteJid, {
      text: `Usage:\n\n${PREFIX}setprefix !`
    });
    return;
  }

  const oldPrefix = PREFIX;

  PREFIX = newPrefix;

  saveData();

  await sock.sendMessage(message.key.remoteJid, {
    text: `╭━━━〔 ⚙ PREFIX UPDATED 〕━━━╮

✅ Prefix changed successfully!

Old Prefix: ${oldPrefix}

New Prefix: ${PREFIX}

📌 Use ${PREFIX}menu from now on.

🤖 SILVER BOT

╰━━━━━━━━━━━━━━━━━━━━━━╯`
  });

  return;
}
        if (command === "resetprefix") {

  if (!isOwner) {
    await sock.sendMessage(message.key.remoteJid, {
      text: "❌ Only the bot owner can reset the prefix."
    });
    return;
  }

  PREFIX = ".";

  saveData();

  await sock.sendMessage(message.key.remoteJid, {
    text: `╭━━━〔 ⚙ PREFIX RESET 〕━━━╮

✅ Prefix has been reset!

Current Prefix: ${PREFIX}

📌 Use ${PREFIX}menu from now on.

🤖 SILVER BOT

╰━━━━━━━━━━━━━━━━━━━━━━╯`
  });

  return;
}
        if (command === "help") {
          await sock.sendMessage(message.key.remoteJid, {
            text: `╭───────────────────╮
│    *SILVER-BOT*     │
╰───────────────────╯

👤 *Built by:* SILVER
📌 *Version:* 1.0

┌─────── *FEATURES* ───────┐
│                          │
│ • Group Management       │
│ • Hidden/Visible Tags    │
│ • View-Once Saver        │
│ • Profile Pic Extractor  │
│ • Sticker Commands       │
│ • Anti-Link System       │
│ • Warning System         │
│ • Crypto Prices          │
│ • TikTok Downloader      │
│ • Sticker Converter      │
│ • Fun Games (RTW, WCG)   │
│                          │
└──────────────────────────┘

┌────── *HOW TO USE* ────
│                          │
│ 1. Type ${PREFIX}menu for│
│   cmds.                  │
│ 2. Reply to use actions  │
│ 3. Stickers = quick cmds │
│ 4. .public / .private    │
│                          │
└──────────────────────

⚡ *Current Mode:* ${botMode.toUpperCase()}

_Use responsibly!_`,
          });
          return;
        }

        // 400Q Game (DM Only)
        if (command === "400q") {
          // Check if game already active
          if (q400Games.has(message.key.remoteJid)) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "400Q already active!\nType .end to stop it.",
            });
            return;
          }

          // Create new game
          const game = create400QGame(message.key.remoteJid);
          
          const sentMsg = await sock.sendMessage(message.key.remoteJid, {
            text: `╭─────────────────╮
│    🎯 *400Q*    │
├─────────────────┤
│ Game Started!
├─────────────────┤
│ *Player 1:*
│ Pick a number 1-400
│
│ _(Reply to this msg)_
╰─────────────────╯`
          });
          
          game.lastBotMessageId = sentMsg.key.id;
          return;
        }

        // End 400Q game in DM
        if (command === "end" && q400Games.has(message.key.remoteJid)) {
          end400QGame(message.key.remoteJid);
          await sock.sendMessage(message.key.remoteJid, {
            text: `400Q ended!`
          });
          return;
        }

        if (command === "ping") {
          const now = Date.now();
          await sock.sendMessage(message.key.remoteJid, {
            text: `PONG!\nBot is online and responding\nLatency: ${Date.now() - now}ms\nMode: ${botMode.toUpperCase()}`,
          });
          return;
        }

        // ============================================
        // Anti-Delete Command (DM - Owner Only)
        // ============================================
        if (command === "antidel" && canUseDM) {
          const option = args[0]?.toLowerCase();
          
          if (option === "on") {
            antiDeleteEnabled = true;
            saveData();
            await sock.sendMessage(message.key.remoteJid, {
              text: `✅ *Anti-Delete Enabled*\n\nDeleted messages will be sent to your DM.`,
            });
          } else if (option === "off") {
            antiDeleteEnabled = false;
            messageCache.clear();
            saveData();
            await sock.sendMessage(message.key.remoteJid, {
              text: `❌ *Anti-Delete Disabled*`,
            });
          } else {
            await sock.sendMessage(message.key.remoteJid, {
              text: `*Anti-Delete Status:* ${antiDeleteEnabled ? 'ON ✅' : 'OFF ❌'}\n\n*Usage:*\n.antidel on - Enable\n.antidel off - Disable\n\n_Deleted messages from groups & DMs will be sent to your DM._`,
            });
          }
          return;
        }

        // ============================================
        // AFK Command (DM)
        // ============================================
        if (command === "afk" && canUseDM) {
          const reason = args.join(' ').trim() || 'No reason given';
          
          afkUsers[sender] = {
            reason: reason,
            time: Date.now()
          };
          saveData();
          
          await sock.sendMessage(message.key.remoteJid, {
            text: `\uD83D\uDCA4 *You are now AFK*\n\n\uD83D\uDCDD Reason: ${reason}`,
          });
          return;
        }

        // ============================================
        // Back Command (Return from AFK)
        // ============================================
        if (command === "back") {
          if (!afkUsers[sender]) {
            await sock.sendMessage(message.key.remoteJid, {
              text: `❌ You're not AFK!`,
            });
            return;
          }
          
          const afkData = afkUsers[sender];
          const duration = Math.floor((Date.now() - afkData.time) / 60000);
          delete afkUsers[sender];
          saveData();
          
          await sock.sendMessage(message.key.remoteJid, {
            text: `🔙 *Welcome back!*\n\n⏱️ You were AFK for ${duration} minute${duration !== 1 ? 's' : ''}.`,
          });
          return;
        }

        // ============================================
        // Translate Command
        // ============================================
        if (command === "tr" || command === "translate") {
          let textToTranslate = '';
          let targetLang = 'en';
          
          // Check if replying to a message
          const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          if (quotedMsg) {
            textToTranslate = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || '';
            targetLang = args[0] || 'en';
          } else {
            // Format: .tr [lang] [text] or .tr [text] (defaults to English)
            if (args.length === 0) {
              await sock.sendMessage(message.key.remoteJid, {
                text: `🌐 *Translate Command*\n\n*Usage:*\n• .tr [lang] [text]\n• Reply to message with .tr [lang]\n\n*Languages:*\nen, es, fr, de, it, pt, ru, ar, zh, ja, ko, hi, tr, nl, pl, sv, vi, th, id, ms\n\n*Example:*\n.tr es Hello world\n.tr fr How are you?`,
              });
              return;
            }
            
            // Check if first arg is a language code (2 letters)
            const langCodes = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ar', 'zh', 'ja', 'ko', 'hi', 'tr', 'nl', 'pl', 'sv', 'vi', 'th', 'id', 'ms', 'bn', 'uk', 'cs', 'el', 'he', 'hu', 'ro', 'fi', 'da', 'no'];
            
            if (args[0] && langCodes.includes(args[0].toLowerCase())) {
              targetLang = args[0].toLowerCase();
              textToTranslate = args.slice(1).join(' ');
            } else {
              // No lang specified, default to English
              textToTranslate = args.join(' ');
            }
          }
          
          if (!textToTranslate.trim()) {
            await sock.sendMessage(message.key.remoteJid, {
              text: `❌ No text to translate!`,
            });
            return;
          }
          
          await sock.sendMessage(message.key.remoteJid, {
            react: { text: "🌐", key: message.key },
          });
          
          try {
            // Try Google Translate API (free unofficial endpoint)
            const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(textToTranslate)}`;
            
            const response = await axios.get(googleUrl, {
              timeout: 10000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            });
            
            if (response.data && response.data[0]) {
              // Extract translated text from response
              let translated = '';
              for (const part of response.data[0]) {
                if (part[0]) translated += part[0];
              }
              
              const detectedLang = response.data[2] || 'auto';
              
              await sock.sendMessage(message.key.remoteJid, {
                text: `🌐 *Translation*\n\n📝 *Original (${detectedLang.toUpperCase()}):*\n${textToTranslate}\n\n✅ *Translated (${targetLang.toUpperCase()}):*\n${translated}`,
              });
            } else {
              throw new Error('Translation failed');
            }
          } catch (error) {
            logger.error({ error: error.message }, 'Translation error');
            await sock.sendMessage(message.key.remoteJid, {
              text: `❌ Translation failed. Try again later.`,
            });
          }
          return;
        }

        if (command === "public") {
          if (!isOwner) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Owner only.",
            });
            return;
          }
          botMode = "public";
          await sock.sendMessage(message.key.remoteJid, {
            text: "✅ Bot set to public.",
          });
          logger.info('Bot mode changed to PUBLIC');
          return;
        }

        if (command === "private") {
          if (!isOwner) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Owner only.",
            });
            return;
          }
          botMode = "private";
          await sock.sendMessage(message.key.remoteJid, {
            text: "🔒 Bot set to private.",
          });
          logger.info('Bot mode changed to PRIVATE');
          return;
        }

        if (command === "live" && canUseDM) {
          const symbol = args[0];
          if (!symbol) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Usage: .live [symbol]\n\nExamples:\n.live btc\n.live eth\n.live sol",
            });
            return;
          }

          await sock.sendMessage(message.key.remoteJid, {
            react: { text: "⏳", key: message.key },
          });

          const data = await fetchCryptoPrice(symbol);

          if (!data) {
            const upperSym = symbol.toUpperCase();

            await sock.sendMessage(message.key.remoteJid, {
              text: `❌ Could not find data for *${upperSym}*\n\n💡 *Tips:*\n• Check if the symbol/name is correct\n• Try the full token name (e.g. "pepe")\n• Try pasting a contract address\n\nExamples: .live btc, .live pepe, .live coai`,
            });
            return;
          }

          const price = parseFloat(data.lastPrice).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 8
          });
          const change24h = parseFloat(data.priceChangePercent).toFixed(2);
          const volume = parseFloat(data.volume).toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
          });
          const marketCap = parseFloat(data.marketCap).toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
          });
          const changeEmoji = change24h >= 0 ? "📈" : "📉";
          const changeSign = change24h >= 0 ? "+" : "";
          const nameStr = data.name ? ` (${data.name})` : '';
          const chainStr = data.chain ? `\n⛓️ Chain: ${data.chain}` : '';
          const dexStr = data.dex ? `\n🏦 DEX: ${data.dex}` : '';
          const linkStr = data.pairUrl ? `\n\n🔗 ${data.pairUrl}` : '';

          await sock.sendMessage(message.key.remoteJid, {
            text: `💹 *${data.symbol}*${nameStr} Live Price\n\n💰 *Price:* $${price}\n${changeEmoji} *24h Change:* ${changeSign}${change24h}%\n\n📊 *24h Stats:*\n📦 Volume: $${volume}\n💎 Market Cap: $${marketCap}${chainStr}${dexStr}\n\n⏰ Updated: ${new Date().toLocaleTimeString()}\n💡 Source: ${data.source || 'DexScreener'}${linkStr}`,
          });

          await sock.sendMessage(message.key.remoteJid, {
            react: { text: "✅", key: message.key },
          });
          return;
        }

   if (command === "vv" && canUseDM) {
          try {
            const quoted = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "❌ Reply to a view-once message.",
              });
              return;
            }

            const viewOnceMsg = await extractViewOnceMedia(quoted);
            if (!viewOnceMsg) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "❌ Not a view-once message.",
              });
              return;
            }

            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "⏳", key: message.key },
            });

            const media = await downloadViewOnceMedia(viewOnceMsg);
            if (!media || !media.mediaData) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "❌ Download failed. Try again.",
              });
              return;
            }

            // Send the media back as a regular message to the current chat
            const sendOptions = {
              caption: media.caption || '',
            };

            if (media.mediaType === "image") {
              sendOptions.image = media.mediaData;
            } else if (media.mediaType === "video") {
              sendOptions.video = media.mediaData;
            }

            await sock.sendMessage(message.key.remoteJid, sendOptions, {
              quoted: message,
            });

            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "✅", key: message.key },
            });

          } catch (error) {
            logger.error({ error: error.message, stack: error.stack }, 'VV command error');
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Error processing view-once.",
            });
          }
          return;
        }

        // ============================================
        // Take Sticker Command (DM)
        // ============================================
        if (command === "take" && canUseDM) {
          try {
            const quoted = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted?.stickerMessage) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "❌ Reply to a sticker.",
              });
              return;
            }
            
            // Download the sticker
            const stream = await downloadContentFromMessage(quoted.stickerMessage, 'sticker');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
              buffer = Buffer.concat([buffer, chunk]);
            }
            
            // Send back as sticker
            await sock.sendMessage(message.key.remoteJid, {
              sticker: buffer,
            });

            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "✅", key: message.key },
            });

            setTimeout(async () => {
              try {
                await sock.sendMessage(message.key.remoteJid, {
                  react: { text: "", key: message.key },
                });
              } catch (err) {}
            }, 1000);

            logger.info('Sticker taken (DM) successfully');
          } catch (err) {
            logger.error({ error: err.message }, 'Take sticker DM error');
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Failed to take sticker.",
            });
          }
          return;
        }

        if (command === "sticker" && canUseDM) {
          try {
            const quoted = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "❌ Reply to an image or video.",
              });
              return;
            }

            const imageMsg = quoted?.imageMessage;
            const videoMsg = quoted?.videoMessage;
            
            if (!imageMsg && !videoMsg) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "❌ Image or video only.",
              });
              return;
            }

            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "⏳", key: message.key },
            });

            // Get custom sticker name from args
            const stickerName = args.join(' ').trim() || 'LUCA Bot';

            let stickerBuffer;
            
            if (imageMsg) {
              const stream = await downloadContentFromMessage(imageMsg, 'image');
              let buffer = Buffer.from([]);
              for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
              }
              stickerBuffer = await convertToSticker(buffer);
            } else if (videoMsg) {
              const stream = await downloadContentFromMessage(videoMsg, 'video');
              let buffer = Buffer.from([]);
              for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
              }
              stickerBuffer = await convertVideoToSticker(buffer);
            }

            if (!stickerBuffer) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "❌ Failed to create sticker.",
              });
              return;
            }

            await sock.sendMessage(message.key.remoteJid, {
              sticker: stickerBuffer,
            });

            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "✅", key: message.key },
            });
          } catch (err) {
            logger.error({ error: err.message }, 'Sticker DM error');
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Failed to create sticker.",
            });
          }
          return;
        }

        // ============================================
        // Sticker to Image Command (DM)
        // ============================================
        if (command === "toimg" && canUseDM) {
          try {
            const quoted = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted?.stickerMessage) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "\u274C Reply to a sticker to convert it to an image.",
              });
              return;
            }

            if (quoted.stickerMessage.isAnimated) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "\u274C Animated stickers are not supported. Only static stickers can be converted.",
              });
              return;
            }

            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "\u23F3", key: message.key },
            });

            const stream = await downloadContentFromMessage(quoted.stickerMessage, 'sticker');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
              buffer = Buffer.concat([buffer, chunk]);
            }

            const imageBuffer = await sharp(buffer).png().toBuffer();

            await sock.sendMessage(message.key.remoteJid, {
              image: imageBuffer,
              caption: '\uD83D\uDDBC\uFE0F Sticker converted to image!',
            });

            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "\u2705", key: message.key },
            });
          } catch (err) {
            logger.error({ error: err.message }, 'ToImg DM error');
            await sock.sendMessage(message.key.remoteJid, {
              text: "\u274C Failed to convert sticker to image.",
            });
          }
          return;
        }

        // ============================================
        // Video/Audio to MP3 Command (DM)
        // ============================================
        if (command === "tomp3" && canUseDM) {
          try {
            const quoted = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted?.videoMessage && !quoted?.audioMessage) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "\u274C Reply to a video or audio message to extract audio.",
              });
              return;
            }

            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "\u23F3", key: message.key },
            });

            let buffer = Buffer.from([]);
            let mediaType;

            if (quoted.videoMessage) {
              const stream = await downloadContentFromMessage(quoted.videoMessage, 'video');
              for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
              }
              mediaType = 'video';
            } else if (quoted.audioMessage) {
              const stream = await downloadContentFromMessage(quoted.audioMessage, 'audio');
              for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
              }
              mediaType = 'audio';
            }

            const { execSync } = require('child_process');
            const tempDir = path.join(__dirname, 'temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            const tempInput = path.join(tempDir, `input_${Date.now()}.${mediaType === 'video' ? 'mp4' : 'ogg'}`);
            const tempOutput = path.join(tempDir, `output_${Date.now()}.mp3`);

            fs.writeFileSync(tempInput, buffer);
            execSync(`ffmpeg -i "${tempInput}" -vn -ab 128k -ar 44100 -y "${tempOutput}"`, { stdio: 'pipe' });

            const mp3Buffer = fs.readFileSync(tempOutput);

            fs.unlinkSync(tempInput);
            fs.unlinkSync(tempOutput);

            await sock.sendMessage(message.key.remoteJid, {
              audio: mp3Buffer,
              mimetype: 'audio/mpeg',
              ptt: false,
            });

            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "\u2705", key: message.key },
            });
          } catch (err) {
            logger.error({ error: err.message }, 'ToMP3 DM error');
            await sock.sendMessage(message.key.remoteJid, {
              text: "\u274C Failed to convert to MP3. Make sure ffmpeg is installed.",
            });
          }
          return;
        }

        if (command === "play" && canUseDM) {
          await playSongCommand(sock, message, args, logger);
          return;
        }

        // ============================================
        // TikTok Video Downloader (DM)
        // ============================================
        if ((command === "tt" || command === "tiktok") && canUseDM) {
          let tiktokUrl = args.join(' ').trim();
          
          // Check if replying to a message with a TikTok URL
          if (!tiktokUrl) {
            const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quotedMsg) {
              const quotedText = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || '';
              const urlMatch = quotedText.match(/https?:\/\/(www\.)?(tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)[^\s]*/i);
              if (urlMatch) {
                tiktokUrl = urlMatch[0];
              }
            }
          }
          
          if (!tiktokUrl || !tiktokUrl.match(/tiktok\.com/i)) {
            await sock.sendMessage(message.key.remoteJid, {
              text: `❌ *Usage:* .tt [tiktok url]\n\nOr reply to a TikTok link with .tt`,
            });
            return;
          }
          
          await sock.sendMessage(message.key.remoteJid, {
            react: { text: "⏳", key: message.key },
          });
          
          try {
            const apiUrl = `https://api.idledeveloper.tech/api/tiktok?url=${encodeURIComponent(tiktokUrl)}`;
            const response = await axios.get(apiUrl, {
              timeout: 30000,
              headers: { 'X-API-Key': 'tiktok_e176b399ccea758d1aa6bbc8d29533dde9fbcd96d827460e' }
            });
            
            if (response.data && response.data.success && response.data.data) {
              const data = response.data.data;
              const videoUrl = data.video?.noWatermark || data.video?.hdNoWatermark || data.video?.watermark || data.downloadUrls?.noWatermark;
              
              if (videoUrl) {
                await sock.sendMessage(message.key.remoteJid, {
                  react: { text: "✅", key: message.key },
                });
                
                // Build caption with stats
                let caption = `🎵 *TikTok Download*\n\n`;
                if (data.author) caption += `👤 *Author:* ${data.author || data.authorUsername || 'Unknown'}\n`;
                if (data.description) caption += `📝 ${data.description}\n`;
                if (data.stats) {
                  caption += `\n❤️ ${data.stats.likes?.toLocaleString() || 0} • 💬 ${data.stats.comments?.toLocaleString() || 0} • 🔄 ${data.stats.shares?.toLocaleString() || 0}`;
                }
                
                await sock.sendMessage(message.key.remoteJid, {
                  video: { url: videoUrl },
                  caption: caption,
                });
              } else {
                throw new Error('No video URL found');
              }
            } else {
              throw new Error(response.data?.message || 'API error');
            }
          } catch (error) {
            logger.error({ error: error.message }, 'TikTok download error (DM)');
            await sock.sendMessage(message.key.remoteJid, {
              react: { text: "❌", key: message.key },
            });
            await sock.sendMessage(message.key.remoteJid, {
              text: `❌ Failed to download TikTok video.\n\n_Try again or check if the URL is valid._`,
            });
          }
          return;
        }

        // STICKER COMMAND DETECTION (DM) - Use canUseAsOwner OR canUseDM OR fromMe
        const canUseStickerDM = canUseAsOwner || canUseDM || message.key.fromMe;
        
        if (message.message.stickerMessage && !text && canUseStickerDM) {
          const stickerHash = message.message.stickerMessage.fileSha256 ? Buffer.from(message.message.stickerMessage.fileSha256).toString('base64') : null;

          for (const [cmdName, hash] of Object.entries(stickerCommands)) {
            if (hash === stickerHash || hash === true || (typeof hash === 'object' && hash.hash === stickerHash)) {
              if (cmdName === "vv") {
                try {
                  const contextInfo = message.message.stickerMessage?.contextInfo;
                  if (!contextInfo || !contextInfo.quotedMessage) return;

                  const quoted = contextInfo.quotedMessage;
                  const viewOnceMsg = await extractViewOnceMedia(quoted);
                  if (!viewOnceMsg) return;

                  const media = await downloadViewOnceMedia(viewOnceMsg);
                  if (!media) return;

                  const ownerJid = BOT_OWNER + "@s.whatsapp.net";
                  if (media.mediaType === "image") {
                    await sock.sendMessage(ownerJid, {
                      image: media.mediaData,
                      caption: `📸 View-once from DM (via sticker)\n${media.caption || ""}`,
                    });
                  } else if (media.mediaType === "video") {
                    await sock.sendMessage(ownerJid, {
                      video: media.mediaData,
                      caption: `🎥 View-once from DM (via sticker)\n${media.caption || ""}`,
                    });
                  }

                  logger.info('View-once from DM saved via sticker');
                } catch (err) {
                  logger.error({ error: err.message }, 'DM sticker vv error');
                }
                return;
              } else if (cmdName === "sticker") {
                try {
                  const contextInfo = message.message.stickerMessage?.contextInfo;
                  if (!contextInfo?.quotedMessage?.imageMessage) return;

                  const imageMsg = contextInfo.quotedMessage.imageMessage;
                  const stream = await downloadContentFromMessage(imageMsg, 'image');
                  let buffer = Buffer.from([]);
                  for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                  }

                  const stickerBuffer = await convertToSticker(buffer);
                  if (stickerBuffer) {
                    await sock.sendMessage(message.key.remoteJid, {
                      sticker: stickerBuffer,
                    });
                  }
                } catch (err) {
                  logger.error({ error: err.message }, 'DM sticker converter error');
                }
                return;
              }
            }
          }
          return;
        }

        if (command === "setsticker" && isOwner) {
          const cmdName = args[0]?.toLowerCase();
          const sticker = message.message.extendedTextMessage?.contextInfo
            ?.quotedMessage?.stickerMessage;

          if (!sticker || !cmdName) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Reply to a sticker with .setsticker [command]",
            });
            return;
          }

          if (!["kick", "open", "lock", "vv", "hidetag", "pp", "sticker"].includes(cmdName)) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Commands: kick, open, lock, vv, hidetag, pp, sticker",
            });
            return;
          }

          const stickerHash = sticker.fileSha256 ? Buffer.from(sticker.fileSha256).toString('base64') : null;

          if (cmdName === "sticker") {
            stickerCommands[cmdName] = { type: "sticker_converter", hash: stickerHash };
          } else {
            stickerCommands[cmdName] = stickerHash || true;
          }
          saveData(); // Persist to JSON

          await sock.sendMessage(message.key.remoteJid, {
            text: `✅ Sticker set to *${cmdName.toUpperCase()}*.`,
          });
          logger.info({ command: cmdName }, 'Sticker command set from DM');
          return;
        }

        if (command === "join" && isOwner) {
          try {
            const groupLink = text?.split(" ").slice(1).join(" ")?.trim();

            if (!groupLink) {
              await sock.sendMessage(message.key.remoteJid, {
                text: `❌ Usage: .join [WhatsApp Group Link]\n\nExample:\n.join https://chat.whatsapp.com/ABCDEF123456`,
              });
              return;
            }

            if (!groupLink.includes("chat.whatsapp.com")) {
              await sock.sendMessage(message.key.remoteJid, {
                text: `❌ Invalid WhatsApp group link!`,
              });
              return;
            }

            let code = "";
            if (groupLink.includes("chat.whatsapp.com/")) {
              code = groupLink.split("chat.whatsapp.com/")[1]?.trim();
            }

            if (!code || code.length < 10) {
              await sock.sendMessage(message.key.remoteJid, {
                text: `❌ Invalid group link format!`,
              });
              return;
            }

            const response = await sock.groupAcceptInvite(code);

            await sock.sendMessage(message.key.remoteJid, {
              text: `✅ Successfully joined the group!`,
            });
            logger.info({ code }, 'Joined group');
          } catch (err) {
            logger.error({ error: err.message }, 'Join error');
            let errorMsg = `❌ Failed to join group.\n\nPossible reasons:\n• Invalid link\n• Already in group\n• Link expired`;

            if (err.message.includes("already")) {
              errorMsg = `❌ You are already in this group!`;
            } else if (err.message.includes("expired")) {
              errorMsg = `❌ This invite link has expired!`;
            }

            await sock.sendMessage(message.key.remoteJid, {
              text: errorMsg,
            });
          }
          return;
        }

        if (command === "delete" && canUseDM) {
          try {
            const quoted = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted) {
              await sock.sendMessage(message.key.remoteJid, {
                text: "❌ Reply to a message.",
              });
              return;
            }

            const quotedKey = {
              remoteJid: message.key.remoteJid,
              fromMe: true,
              id: message.message.extendedTextMessage?.contextInfo?.stanzaId,
            };

            await sock.sendMessage(message.key.remoteJid, {
              delete: quotedKey,
            });
          } catch (err) {
            logger.error({ error: err.message }, 'Delete DM error');
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Failed to delete.",
            });
          }
          return;
        }

        if (command === "block" && isOwner) {
          if (!args[0]) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Provide the phone number.\n\nExample: .block 2348012345678",
            });
            return;
          }
          const num = args[0].replace(/[^0-9]/g, '');
          const targetJid = `${num}@s.whatsapp.net`;
          try {
            await sock.updateBlockStatus(targetJid, 'block');
            await sock.sendMessage(message.key.remoteJid, {
              text: `✅ ${num} blocked.`,
            });
            logger.info({ target: targetJid }, 'User blocked via WhatsApp API from DM');
          } catch (err) {
            logger.error({ error: err.message }, 'Block from DM failed');
            await sock.sendMessage(message.key.remoteJid, {
              text: `❌ Failed to block: ${err.message}`,
            });
          }
          return;
        }

        if (command === "unblock" && isOwner) {
          if (!args[0]) {
            await sock.sendMessage(message.key.remoteJid, {
              text: "❌ Provide the phone number.\n\nExample: .unblock 2348012345678",
            });
            return;
          }
          const num = args[0].replace(/[^0-9]/g, '');
          const targetJid = `${num}@s.whatsapp.net`;
          try {
            await sock.updateBlockStatus(targetJid, 'unblock');
            await sock.sendMessage(message.key.remoteJid, {
              text: `✅ ${num} unblocked.`,
            });
            logger.info({ target: targetJid }, 'User unblocked via WhatsApp API from DM');
          } catch (err) {
            logger.error({ error: err.message }, 'Unblock from DM failed');
            await sock.sendMessage(message.key.remoteJid, {
              text: `❌ Failed to unblock: ${err.message}`,
            });
          }
          return;
        }

        if (text && text.startsWith(PREFIX)) {
          // Unknown command error
          await sock.sendMessage(message.key.remoteJid, {
            text: `❌ Unknown command. Type ${PREFIX}menu for help.`,
          });
          return;
        }
      }
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Error handling message');
    }
  });
}

// Play music command function
async function playSongCommand(sock, message, args, logger) {
  if (!args || args.length < 1) {
    await sock.sendMessage(message.key.remoteJid, {
      text: "❌ Usage: .play [song name]",
    });
    return;
  }

  const query = args.join(' ');

  await sock.sendMessage(message.key.remoteJid, {
    react: { text: "⏳", key: message.key },
  });

  try {
    // Step 1: Search YouTube
    const searchResults = await yts(query);
    const videos = searchResults.videos;

    if (!videos || videos.length === 0) {
      await sock.sendMessage(message.key.remoteJid, {
        text: "❌ No results found.",
      });
      return;
    }

    const video = videos[0];

    // Limit to 10 minutes
    if (video.seconds > 600) {
      await sock.sendMessage(message.key.remoteJid, {
        text: "❌ Song is too long (max 10 minutes).",
      });
      return;
    }

    // Step 2: Download audio using youtube-dl-exec (bundles its own yt-dlp binary, no Python needed)
    const tmpDir = require('os').tmpdir();
    const tempId = `play_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await youtubedl(video.url, {
      format: 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio',
      noPlaylist: true,
      noWarnings: true,
      output: path.join(tmpDir, `${tempId}.%(ext)s`),
    });

    // Find the downloaded file
    const possibleExts = ['.m4a', '.webm', '.mp3', '.opus', '.ogg'];
    const mimeMap = { '.m4a': 'audio/mp4', '.webm': 'audio/webm', '.mp3': 'audio/mpeg', '.opus': 'audio/ogg', '.ogg': 'audio/ogg' };
    let audioFile = null;
    let mimetype = 'audio/mp4';

    for (const ext of possibleExts) {
      const f = path.join(tmpDir, `${tempId}${ext}`);
      if (fs.existsSync(f)) {
        audioFile = f;
        mimetype = mimeMap[ext] || 'audio/mp4';
        break;
      }
    }

    if (!audioFile) {
      throw new Error('Downloaded file not found');
    }

    const audioBuffer = fs.readFileSync(audioFile);
    fs.unlinkSync(audioFile); // cleanup temp file

    // Check file size (WhatsApp limit ~16MB for audio)
    if (audioBuffer.length > 16 * 1024 * 1024) {
      await sock.sendMessage(message.key.remoteJid, {
        text: "❌ File too large to send.",
      });
      return;
    }

    // Step 3: Send audio with song info
    await sock.sendMessage(message.key.remoteJid, {
      audio: audioBuffer,
      mimetype,
      ptt: false
    });

    await sock.sendMessage(message.key.remoteJid, {
      text: `🎵 *${video.title}*\n👤 ${video.author.name}\n⏱️ ${video.timestamp}`,
    });

    await sock.sendMessage(message.key.remoteJid, {
      react: { text: "✅", key: message.key },
    });

    logger.info({ song: video.title, query }, 'Song played successfully');

  } catch (error) {
    logger.error({ error: error.message }, 'Play command error');
    await sock.sendMessage(message.key.remoteJid, {
      text: "❌ Download failed. Please try again.",
    });
  }
}

console.clear();
console.log("   ⚔️ KAIDO BOT v2.0 ⚔️          ");
console.log("   Starting...                  ");

startBot().catch((err) => {
  logger.error({ error: err.message, stack: err.stack }, 'Bot startup error');
});

process.on("SIGINT", () => {
  logger.info('Bot stopping gracefully...');
  saveData(); // Save data before exiting
  logger.info('Data saved. Bot stopped.');
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  logger.error({ error: err.message, stack: err.stack }, 'Uncaught exception');
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error({ reason }, 'Unhandled rejection');
});

