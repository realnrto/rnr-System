const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, SlashCommandBuilder, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
require('dotenv').config();


// Bot Configuration
const TOKEN = process.env.DISCORD_TOKEN;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

// نظام الرتب - معرفات الرتب من متغيرات البيئة
const RANKS = {
    // High Management
    FOUNDER: process.env.FOUNDER_ROLE_ID,
    VICE_FOUNDER: process.env.VICE_FOUNDER_ROLE_ID,
    SERVER_CEO: process.env.SERVER_CEO_ROLE_ID,
    SERVER_COO: process.env.SERVER_COO_ROLE_ID,
    
    // High Staff Team
    GENERAL_MANAGER: process.env.GENERAL_MANAGER_ROLE_ID,
    HIGHER_MANAGEMENT: process.env.HIGHER_MANAGEMENT_ROLE_ID,
    PRESIDENT: process.env.PRESIDENT_ROLE_ID,
    VICE_PRESIDENT: process.env.VICE_PRESIDENT_ROLE_ID,
    LEAD_ADMIN: process.env.LEAD_ADMIN_ROLE_ID,
    SENIOR_ADMIN: process.env.SENIOR_ADMIN_ROLE_ID,
    
    // Staff Team
    ADMIN_PLUS: process.env.ADMIN_PLUS_ROLE_ID,
    ADMIN: process.env.ADMIN_ROLE_ID,
    TRIAL_ADMIN: process.env.TRIAL_ADMIN_ROLE_ID,
    
    // Support Team
    SUPPORT_PLUS: process.env.SUPPORT_PLUS_ROLE_ID,
    SUPPORT: process.env.SUPPORT_ROLE_ID,
    TRIAL_SUPPORT: process.env.TRIAL_SUPPORT_ROLE_ID,
    
    // Helper Team
    CHAT_SUPERVISOR: process.env.CHAT_SUPERVISOR_ROLE_ID,
    ASSISTANT: process.env.ASSISTANT_ROLE_ID
};

// ترتيب الرتب من الأعلى للأقل (للتحقق من أعلى رتبة)
const RANK_HIERARCHY = [
    { id: 'FOUNDER', name: 'Founder', emoji: '👑', level: 100 },
    { id: 'VICE_FOUNDER', name: 'Vice Founder', emoji: '💎', level: 95 },
    { id: 'SERVER_CEO', name: 'Server CEO', emoji: '🔱', level: 90 },
    { id: 'SERVER_COO', name: 'Server COO', emoji: '🔰', level: 85 },
    { id: 'GENERAL_MANAGER', name: 'General Manager', emoji: '💼', level: 80 },
    { id: 'HIGHER_MANAGEMENT', name: 'Higher Management', emoji: '🎖️', level: 75 },
    { id: 'PRESIDENT', name: 'President', emoji: '🏆', level: 70 },
    { id: 'VICE_PRESIDENT', name: 'Vice President', emoji: '🥇', level: 65 },
    { id: 'LEAD_ADMIN', name: 'Lead Admin', emoji: '🔥', level: 60 },
    { id: 'SENIOR_ADMIN', name: 'Senior Admin', emoji: '⚔️', level: 55 },
    { id: 'ADMIN_PLUS', name: 'Admin+', emoji: '🔴', level: 35 },
    { id: 'ADMIN', name: 'Admin', emoji: '🔴', level: 30 },
    { id: 'TRIAL_ADMIN', name: 'Trial Admin', emoji: '🔴', level: 25 },
    { id: 'SUPPORT_PLUS', name: 'Support+', emoji: '🟢', level: 20 },
    { id: 'SUPPORT', name: 'Support', emoji: '🟢', level: 15 },
    { id: 'TRIAL_SUPPORT', name: 'Trial Support', emoji: '🟢', level: 10 },
    { id: 'CHAT_SUPERVISOR', name: 'Chat Supervisor', emoji: '🟡', level: 5 },
    { id: 'ASSISTANT', name: 'Assistant', emoji: '🔵', level: 1 }
];

// التحقق من وجود المتغيرات المطلوبة
if (!TOKEN) {
    console.error('❌ خطأ: DISCORD_TOKEN غير موجود في ملف .env');
    process.exit(1);
}

if (!LOG_CHANNEL_ID) {
    console.error('❌ خطأ: LOG_CHANNEL_ID غير موجود في ملف .env');
    process.exit(1);
}

// التحقق من وجود معرفات الرتب
const missingRanks = [];
Object.entries(RANKS).forEach(([key, value]) => {
    if (!value) {
        missingRanks.push(key);
    }
});

if (missingRanks.length > 0) {
    console.warn(`⚠️ تحذير: الرتب التالية غير موجودة في ملف .env: ${missingRanks.join(', ')}`);
}


//  * Professional Discord Bot Status Manager
//  * Handles automatic status rotation with management role counting
//  * @author Your Name
//  * @version 2.0.0


class StatusManager extends EventEmitter {
    constructor(client) {
        super();
        this.client = client;
        this.rotationInterval = null;
        this.statusCache = new Map();
        this.lastUpdateTime = null;
        this.config = {
            rotationIntervalMinutes: 1,
            cacheExpireMinutes: 2,
            managementStatusChance: 0.4, // 40% chance for management status
            maxRetries: 3,
            retryDelay: 5000,
            maxMentionsPerField: 99 // Maximum mentions to show per field
        };
    }

    /**
     * Management role hierarchy configuration
     * Higher priority roles are checked first
     */
    static get MANAGEMENT_ROLES() {
        return {
            "Server Owner": {
                roles: [],
                priority: 1,
                arabicName: "مالك السيرفر",
                color: "#FF0000"
            },
            "Founder": {
                roles: [process.env.FOUNDER_ROLE_ID],
                priority: 2,
                arabicName: "المؤسس",
                color: "#FFD700"
            },
            "Vice Founder": {
                roles: [process.env.VICE_FOUNDER_ROLE_ID],
                priority: 3,
                arabicName: "نائب المؤسس",
                color: "#FFA500"
            },
            "Executive Team": {
                roles: [
                    process.env.SERVER_CEO_ROLE_ID,
                    process.env.SERVER_COO_ROLE_ID
                ],
                priority: 4,
                arabicName: "الفريق التنفيذي",
                color: "#FF4500"
            },
            "High Staff Team": {
                roles: [
                    process.env.GENERAL_MANAGER_ROLE_ID,
                    process.env.HIGHER_MANAGEMENT_ROLE_ID,
                    process.env.PRESIDENT_ROLE_ID,
                    process.env.VICE_PRESIDENT_ROLE_ID,
                    process.env.LEAD_ADMIN_ROLE_ID,
                    process.env.SENIOR_ADMIN_ROLE_ID
                ],
                priority: 5,
                arabicName: "الإدارة العليا",
                color: "#DC143C"
            },
            "Staff Team": {
                roles: [
                    process.env.ADMIN_PLUS_ROLE_ID,
                    process.env.ADMIN_ROLE_ID,
                    process.env.TRIAL_ADMIN_ROLE_ID
                ],
                priority: 6,
                arabicName: "فريق الإدارة",
                color: "#4169E1"
            },
            "Support Team": {
                roles: [
                    process.env.SUPPORT_PLUS_ROLE_ID,
                    process.env.SUPPORT_ROLE_ID,
                    process.env.TRIAL_SUPPORT_ROLE_ID
                ],
                priority: 7,
                arabicName: "فريق الدعم",
                color: "#32CD32"
            },
            "Helper Team": {
                roles: [
                    process.env.CHAT_SUPERVISOR_ROLE_ID,
                    process.env.ASSISTANT_ROLE_ID
                ],
                priority: 8,
                arabicName: "فريق المساعدة",
                color: "#20B2AA"
            }
        };
    }

    /**
     * Default watching status messages
     */
    static get DEFAULT_STATUSES() {
        return [
            "قوانين السيرفر",
            "المجتمع وأنشطته",
            "الأعضاء الجدد",
            "نشاط المحادثات",
            "إحصائيات السيرفر",
            "تفاعلات الأعضاء",
            "مخالفات القوانين",
            "القنوات الصوتية",
            "فعاليات السيرفر",
            "نمو المجتمع",
            "أمان السيرفر",
            "جودة المحتوى"
        ];
    }

    /**
     * Initialize the status manager
     */
    async initialize() {
        try {
            this.emit('debug', 'Initializing Status Manager...');
            await this.validateConfiguration();
            await this.startRotation();
            this.emit('ready', 'Status Manager initialized successfully');
            return true;
        } catch (error) {
            this.emit('error', 'Failed to initialize Status Manager', error);
            return false;
        }
    }

    /**
     * Validate bot configuration and permissions
     */
    async validateConfiguration() {
        if (!this.client.user) {
            throw new Error('Bot client not ready');
        }

        const guild = this.client.guilds.cache.first();
        if (!guild) {
            throw new Error('No guilds found');
        }

        const botMember = await guild.members.fetch(this.client.user.id);
        if (!botMember.permissions.has('ChangeNickname')) {
            this.emit('warning', 'Bot may not have permission to change status');
        }

        this.emit('debug', `Configuration validated for guild: ${guild.name}`);
    }

    /**
     * Count unique members with management roles and collect member data
     * Uses caching to improve performance
     */
    async countManagementMembers() {
        const cacheKey = 'management_counts';
        const cachedData = this.statusCache.get(cacheKey);
        
        if (cachedData && this.isCacheValid(cachedData.timestamp)) {
            return cachedData.data;
        }

        try {
            const guild = this.client.guilds.cache.first();
            if (!guild) return {};

            const managementCounts = {};
            const allManagementMembers = new Set();
            const roles = StatusManager.MANAGEMENT_ROLES;

            // Sort roles by priority
            const sortedRoles = Object.entries(roles).sort((a, b) => a[1].priority - b[1].priority);

            for (const [categoryName, config] of sortedRoles) {
                const uniqueMembers = new Set();
                const memberObjects = [];

                if (categoryName === "Server Owner") {
                    if (guild.ownerId) {
                        const owner = await guild.members.fetch(guild.ownerId).catch(() => null);
                        if (owner && !owner.user.bot) {
                            uniqueMembers.add(owner.id);
                            memberObjects.push(owner);
                        }
                    }
                } else {
                    for (const roleId of config.roles) {
                        if (!roleId) continue;

                        const role = guild.roles.cache.get(roleId);
                        if (role) {
                            role.members.forEach(member => {
                                if (!member.user.bot && !uniqueMembers.has(member.id)) {
                                    uniqueMembers.add(member.id);
                                    memberObjects.push(member);
                                }
                            });
                        }
                    }
                }

                managementCounts[categoryName] = {
                    count: uniqueMembers.size,
                    arabicName: config.arabicName,
                    color: config.color,
                    priority: config.priority,
                    members: memberObjects // Store member objects for mentions
                };

                uniqueMembers.forEach(memberId => allManagementMembers.add(memberId));
            }

            managementCounts["Total Management"] = {
                count: allManagementMembers.size,
                arabicName: "إجمالي الإدارة",
                color: "#9932CC",
                priority: 0,
                members: [] // No members array for total
            };

            // Cache the results
            this.statusCache.set(cacheKey, {
                data: managementCounts,
                timestamp: Date.now()
            });

            this.emit('debug', `Management count updated: ${allManagementMembers.size} total members`);
            return managementCounts;

        } catch (error) {
            this.emit('error', 'Error counting management members', error);
            return {};
        }
    }

    /**
     * Check if cached data is still valid
     */
    isCacheValid(timestamp) {
        const expireTime = this.config.cacheExpireMinutes * 60 * 1000;
        return (Date.now() - timestamp) < expireTime;
    }

    /**
     * Get a formatted management status message
     */
    async getManagementStatusMessage() {
        const counts = await this.countManagementMembers();
        
        // Filter categories with members > 0, excluding total
        const availableCategories = Object.entries(counts)
            .filter(([name, data]) => data.count > 0 && name !== "Total Management")
            .sort((a, b) => a[1].priority - b[1].priority);

        if (availableCategories.length === 0) {
            return { text: "الإدارة: غير متاح", color: "#808080" };
        }

        // Select category based on priority with some randomization
        let selectedCategory;
        if (Math.random() < 0.3) {
            // 30% chance to show highest priority role
            selectedCategory = availableCategories[0];
        } else {
            // 70% chance for random selection
            selectedCategory = availableCategories[Math.floor(Math.random() * availableCategories.length)];
        }

        const [categoryName, data] = selectedCategory;
        return {
            text: `${data.arabicName}: ${data.count}`,
            color: data.color
        };
    }

    /**
     * Set bot watching status
     */
    async setWatchingStatus(message, retryCount = 0) {
        try {
            if (!this.client.user) {
                throw new Error('Client user not available');
            }

            await this.client.user.setActivity(message, { 
                type: ActivityType.Watching 
            });

            this.lastUpdateTime = Date.now();
            this.emit('statusUpdate', `Status set: Watching ${message}`);
            return true;

        } catch (error) {
            if (retryCount < this.config.maxRetries) {
                this.emit('warning', `Status update failed, retrying... (${retryCount + 1}/${this.config.maxRetries})`);
                await this.delay(this.config.retryDelay);
                return this.setWatchingStatus(message, retryCount + 1);
            }
            
            this.emit('error', 'Failed to set watching status after retries', error);
            return false;
        }
    }

    /**
     * Set random watching status with smart selection
     */
    async setRandomWatchingStatus() {
        try {
            let statusInfo;

            if (Math.random() < this.config.managementStatusChance) {
                statusInfo = await this.getManagementStatusMessage();
                await this.setWatchingStatus(statusInfo.text);
            } else {
                const randomStatus = StatusManager.DEFAULT_STATUSES[
                    Math.floor(Math.random() * StatusManager.DEFAULT_STATUSES.length)
                ];
                await this.setWatchingStatus(randomStatus);
            }

            return true;
        } catch (error) {
            this.emit('error', 'Failed to set random status', error);
            return false;
        }
    }

    /**
     * Start automatic status rotation
     */
    async startRotation() {
        if (this.rotationInterval) {
            clearInterval(this.rotationInterval);
        }

        // Set initial status
        await this.setRandomWatchingStatus();

        // Start rotation interval
        const intervalMs = this.config.rotationIntervalMinutes * 60 * 1000;
        this.rotationInterval = setInterval(async () => {
            await this.setRandomWatchingStatus();
        }, intervalMs);

        this.emit('debug', `Status rotation started (${this.config.rotationIntervalMinutes} minutes interval)`);
    }

    /**
     * Stop status rotation
     */
    stopRotation() {
        if (this.rotationInterval) {
            clearInterval(this.rotationInterval);
            this.rotationInterval = null;
            this.emit('debug', 'Status rotation stopped');
        }
    }

    /**
     * Format member mentions for embed field
     */
    formatMemberMentions(members) {
        if (!members || members.length === 0) {
            return 'لا يوجد أعضاء';
        }

        const maxMentions = this.config.maxMentionsPerField;
        const mentions = members
            .slice(0, maxMentions)
            .map(member => `<@${member.id}>`)
            .join(' ');

        if (members.length > maxMentions) {
            return `${mentions}\n*و ${members.length - maxMentions} عضو آخر...*`;
        }

        return mentions;
    }

    /**
     * Create professional embed for management statistics with member mentions
     */
    createManagementEmbed(counts) {
        const embed = new EmbedBuilder()
            .setTitle('📊 إحصائيات فرق الإدارة')
            .setDescription('عرض شامل لأعداد أعضاء الإدارة في السيرفر مع منشن الأعضاء')
            .setColor('#0099ff')
            .setTimestamp()
            .setFooter({ 
                text: 'نظام إدارة حالة البوت • يتم التحديث كل دقيقتين',
                iconURL: this.client.user?.displayAvatarURL()
            });

        // Sort by priority and add fields
        const sortedEntries = Object.entries(counts)
            .sort((a, b) => a[1].priority - b[1].priority);

        let totalMembers = 0;
        const managementFields = [];

        for (const [categoryName, data] of sortedEntries) {
            if (categoryName === "Total Management") {
                totalMembers = data.count;
                continue;
            }

            if (data.count > 0) {
                // Add count field
                embed.addFields({
                    name: `${data.arabicName} (${data.count})`,
                    value: `**${data.count}** عضو نشط`,
                    inline: true
                });

                // Add members mention field
                const memberMentions = this.formatMemberMentions(data.members);
                embed.addFields({
                    name: `👥 أعضاء ${data.arabicName}`,
                    value: memberMentions,
                    inline: false
                });

                // Add separator for better readability
                embed.addFields({
                    name: '\u200b',
                    value: '━━━━━━━━━━━━━━━━━━━━━━━━',
                    inline: false
                });
            }
        }

        // Add total field if there are members
        if (totalMembers > 0) {
            embed.addFields({
                name: '📈 الإجمالي العام',
                value: `**${totalMembers}** عضو إدارة نشط في جميع الفرق`,
                inline: false
            });
        }

        // Add empty roles section
        const emptyRoles = sortedEntries.filter(([name, data]) => 
            data.count === 0 && name !== "Total Management"
        );

        if (emptyRoles.length > 0) {
            const emptyRolesList = emptyRoles
                .map(([name, data]) => data.arabicName)
                .join(' • ');
            
            embed.addFields({
                name: '💤 الفرق غير المفعلة',
                value: emptyRolesList,
                inline: false
            });
        }

        return embed;
    }

    /**
     * Create a compact embed for management statistics (without mentions)
     */
    createCompactManagementEmbed(counts) {
        const embed = new EmbedBuilder()
            .setTitle('📊 ملخص إحصائيات فرق الإدارة')
            .setDescription('عرض مختصر لأعداد أعضاء الإدارة في السيرفر')
            .setColor('#0099ff')
            .setTimestamp()
            .setFooter({ 
                text: 'نظام إدارة حالة البوت • للعرض التفصيلي استخدم !managementcount',
                iconURL: this.client.user?.displayAvatarURL()
            });

        // Sort by priority and add fields
        const sortedEntries = Object.entries(counts)
            .sort((a, b) => a[1].priority - b[1].priority);

        let totalMembers = 0;

        for (const [categoryName, data] of sortedEntries) {
            if (categoryName === "Total Management") {
                totalMembers = data.count;
                continue;
            }

            if (data.count > 0) {
                embed.addFields({
                    name: data.arabicName,
                    value: `**${data.count}** عضو`,
                    inline: true
                });
            }
        }

        // Add total field
        if (totalMembers > 0) {
            embed.addFields({
                name: '📈 الإجمالي العام',
                value: `**${totalMembers}** عضو إدارة نشط`,
                inline: false
            });
        }

        return embed;
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get system statistics
     */
    getSystemStats() {
        return {
            uptime: process.uptime(),
            lastUpdate: this.lastUpdateTime,
            cacheSize: this.statusCache.size,
            rotationActive: !!this.rotationInterval,
            config: this.config
        };
    }
}

// Initialize bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Data storage (في بيئة الإنتاج، استخدم قاعدة بيانات)
let userData = {};
let attendanceData = {};
let helpPoints = {}; // نقاط المساعدة

// Load data from files
function loadData() {
    try {
        if (fs.existsSync('userData.json')) {
            userData = JSON.parse(fs.readFileSync('userData.json', 'utf8'));
        }
        if (fs.existsSync('attendanceData.json')) {
            attendanceData = JSON.parse(fs.readFileSync('attendanceData.json', 'utf8'));
        }
        if (fs.existsSync('helpPoints.json')) {
            helpPoints = JSON.parse(fs.readFileSync('helpPoints.json', 'utf8'));
        }
    } catch (error) {
        console.error('خطأ في تحميل البيانات:', error);
    }
}

// Save data to files
function saveData() {
    try {
        fs.writeFileSync('userData.json', JSON.stringify(userData, null, 2));
        fs.writeFileSync('attendanceData.json', JSON.stringify(attendanceData, null, 2));
        fs.writeFileSync('helpPoints.json', JSON.stringify(helpPoints, null, 2));
    } catch (error) {
        console.error('خطأ في حفظ البيانات:', error);
    }
}

// Initialize user data
function initUser(userId) {
    if (!userData[userId]) {
        userData[userId] = {
            points: 0,
            level: 1,
            totalAttendance: 0,
            currentStreak: 0,
            lastAttendance: null,
            warnings: 0,
            isCheckedIn: false,
            checkInTime: null
        };
    }
    
    if (!helpPoints[userId]) {
        helpPoints[userId] = {
            totalHelpPoints: 0,
            helpCount: 0,
            lastHelpDate: null
        };
    }
}

// Initialize status manager
const statusManager = new StatusManager(client);

// Event listeners for status manager
statusManager.on('ready', (message) => {
    console.log(`✅ ${message}`);
});

statusManager.on('error', (message, error) => {
    console.error(`❌ ${message}:`, error);
});

statusManager.on('warning', (message) => {
    console.warn(`⚠️ ${message}`);
});

statusManager.on('debug', (message) => {
    console.log(`🔍 ${message}`);
});

statusManager.on('statusUpdate', (message) => {
    console.log(`🔄 ${message}`);
});

// Bot ready event
client.once('ready', async () => {
    console.log(`🤖 Bot logged in as ${client.user.tag}`);
    console.log(`🌐 Serving ${client.guilds.cache.size} servers`);
    console.log(`👥 Monitoring ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)} members`);
    
    // Initialize status manager
    await statusManager.initialize();
});

// Enhanced command handler
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // Check permissions
    if (!message.member?.permissions.has('Administrator')) return;
    
    const args = message.content.split(' ');
    const command = args[0].toLowerCase();
    
    try {
        switch (command) {
            case '!setstatus':
                const customMessage = args.slice(1).join(' ');
                if (!customMessage.trim()) {
                    return message.reply('❌ يرجى كتابة رسالة الحالة');
                }
                
                const success = await statusManager.setWatchingStatus(customMessage.trim());
                if (success) {
                    message.reply(`✅ تم تعيين الحالة: مراقبة ${customMessage.trim()}`);
                } else {
                    message.reply('❌ فشل في تعيين الحالة');
                }
                break;

            case '!randomstatus':
                const randomSuccess = await statusManager.setRandomWatchingStatus();
                if (randomSuccess) {
                    message.reply('🎲 تم تعيين حالة عشوائية');
                } else {
                    message.reply('❌ فشل في تعيين الحالة العشوائية');
                }
                break;

            case '!managementcount':
                const counts = await statusManager.countManagementMembers();
                const embed = statusManager.createManagementEmbed(counts);
                message.reply({ embeds: [embed] });
                break;

            case '!managementsummary':
                const summaryCount = await statusManager.countManagementMembers();
                const compactEmbed = statusManager.createCompactManagementEmbed(summaryCount);
                message.reply({ embeds: [compactEmbed] });
                break;

            case '!botstats':
                const stats = statusManager.getSystemStats();
                const statsEmbed = new EmbedBuilder()
                    .setTitle('📈 إحصائيات نظام البوت')
                    .setColor('#00ff00')
                    .addFields(
                        { name: '⏱️ وقت التشغيل', value: `${Math.floor(stats.uptime / 3600)}h ${Math.floor((stats.uptime % 3600) / 60)}m`, inline: true },
                        { name: '🔄 آخر تحديث', value: stats.lastUpdate ? `<t:${Math.floor(stats.lastUpdate / 1000)}:R>` : 'لم يتم التحديث بعد', inline: true },
                        { name: '💾 حجم التخزين المؤقت', value: `${stats.cacheSize} عنصر`, inline: true },
                        { name: '🔁 حالة التدوير', value: stats.rotationActive ? '✅ نشط' : '❌ متوقف', inline: true },
                        { name: '👥 حد المنشن لكل فريق', value: `${stats.config.maxMentionsPerField} عضو`, inline: true }
                    )
                    .setTimestamp();
                message.reply({ embeds: [statsEmbed] });
                break;

            case '!reloadstatus':
                statusManager.statusCache.clear();
                await statusManager.setRandomWatchingStatus();
                message.reply('🔄 تم إعادة تحميل نظام الحالة');
                break;

            case '!help':
                const helpEmbed = new EmbedBuilder()
                    .setTitle('🤖 دليل أوامر إدارة حالة البوت')
                    .setDescription('نظام متقدم لإدارة حالة البوت مع إحصائيات الإدارة والمنشن')
                    .setColor('#0099ff')
                    .addFields(
                        {
                            name: '📝 إدارة الحالة',
                            value: '`!setstatus <رسالة>` - تعيين حالة مخصصة\n`!randomstatus` - حالة عشوائية\n`!reloadstatus` - إعادة تحميل النظام',
                            inline: false
                        },
                        {
                            name: '📊 الإحصائيات',
                            value: '`!managementcount` - إحصائيات مفصلة مع منشن الأعضاء\n`!managementsummary` - ملخص الإحصائيات بدون منشن\n`!botstats` - إحصائيات النظام\n`!help` - عرض هذه المساعدة',
                            inline: false
                        },
                        {
                            name: '⚙️ الميزات التلقائية',
                            value: '• تدوير الحالة كل 5 دقائق\n• 40% احتمالية لعرض إحصائيات الإدارة\n• تخزين مؤقت ذكي لتحسين الأداء\n• نظام إعادة المحاولة عند الفشل\n• منشن تلقائي للأعضاء في كل فريق',
                            inline: false
                        },
                        {
                            name: '🏆 الرتب المدعومة',
                            value: 'مالك السيرفر • المؤسس • نائب المؤسس • الفريق التنفيذي • الإدارة العليا • فريق الإدارة • فريق الدعم • فريق المساعدة',
                            inline: false
                        },
                        {
                            name: '💡 ملاحظات مهمة',
                            value: '• يتم عرض حد أقصى 10 منشن لكل فريق\n• استخدم `!managementsummary` للعرض المختصر\n• استخدم `!managementcount` للعرض التفصيلي مع المنشن',
                            inline: false
                        }
                    )
                    .setFooter({ 
                        text: 'نظام إدارة البوت المتقدم • مطلوب صلاحيات المدير',
                        iconURL: client.user?.displayAvatarURL()
                    })
                    .setTimestamp();
                
                message.reply({ embeds: [helpEmbed] });
                break;
        }
    } catch (error) {
        console.error('Command execution error:', error);
        message.reply('❌ حدث خطأ أثناء تنفيذ الأمر').catch(console.error);
    }
});

// Enhanced error handling
client.on('error', (error) => {
    console.error('❌ Discord client error:', error);
});

client.on('warn', (warning) => {
    console.warn('⚠️ Discord client warning:', warning);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Shutting down gracefully...');
    statusManager.stopRotation();
    client.destroy();
    process.exit(0);
});

// Export everything
module.exports = {
    client,
    statusManager,
    StatusManager
};

// الحصول على أعلى رتبة للعضو
function getHighestRank(member) {
    let highestRank = null;
    let highestLevel = -1;
    
    for (const rank of RANK_HIERARCHY) {
        const roleId = RANKS[rank.id];
        if (roleId && member.roles.cache.has(roleId)) {
            if (rank.level > highestLevel) {
                highestLevel = rank.level;
                highestRank = rank;
            }
        }
    }
    
    return highestRank;
}

// التحقق من صلاحيات الترقية لفريق High Staff Team
function canPromoteHighStaff(member) {
    const ceoRole = RANKS.SERVER_CEO;
    const cooRole = RANKS.SERVER_COO;
    
    return (ceoRole && member.roles.cache.has(ceoRole)) || 
           (cooRole && member.roles.cache.has(cooRole));
}

// التحقق من الرتب المؤهلة للعرض (من Admin فما فوق)
function isQualifiedRank(rankId) {
    const qualifiedRanks = [
        'FOUNDER', 'VICE_FOUNDER', 'SERVER_CEO', 'SERVER_COO',  
        'GENERAL_MANAGER', 'HIGHER_MANAGEMENT', 'PRESIDENT', 'VICE_PRESIDENT', 'LEAD_ADMIN', 'SENIOR_ADMIN',
        'ADMIN_PLUS', 'ADMIN', 'TRIAL_ADMIN', 'SuppORT_PLUS', 'SUPPORT', 'TRIAL_SUPPORT',
        'CHAT_SUPERVISOR', 'ASSISTANT'
    ];
    
    return qualifiedRanks.includes(rankId);
}

// Send log message
async function sendLog(guild, embed) {
    try {
        const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
            await logChannel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error('خطأ في إرسال اللوج:', error);
    }
}

// Calculate level based on points
function calculateLevelFromPoints(points) {
    return Math.floor(points / 100) + 1;
}

// Check for level up
function checkLevelUp(userId) {
    const user = userData[userId];
    const newLevel = calculateLevelFromPoints(user.points);
    
    if (newLevel > user.level) {
        user.level = newLevel;
        return true;
    }
    return false;
}

// Get user rank based on points
function getUserRank(points) {
    if (points >= 1000) return { name: 'خبير', color: '#FFD700', emoji: '👑' };
    if (points >= 500) return { name: 'متقدم', color: '#9932CC', emoji: '💜' };
    if (points >= 200) return { name: 'متوسط', color: '#1E90FF', emoji: '💙' };
    if (points >= 50) return { name: 'مبتدئ متميز', color: '#32CD32', emoji: '💚' };
    return { name: 'مبتدئ', color: '#808080', emoji: '🤍' };
}

// Bot ready event
client.once('ready', async () => {
    console.log(`🤖 Bot logged in as ${client.user.tag}`);
    loadData();
    
    // Register slash commands
    const commands = [
        // الأوامر الأساسية
        new SlashCommandBuilder()
            .setName('حضور')
            .setDescription('تسجيل الحضور'),
        
        new SlashCommandBuilder()
            .setName('انصراف')
            .setDescription('تسجيل الانصراف'),
        
        new SlashCommandBuilder()
            .setName('نقاطي')
            .setDescription('عرض نقاطك ومعلوماتك'),
        
        // أوامر الإدارة
        new SlashCommandBuilder()
            .setName('ترقية')
            .setDescription('ترقية عضو')
            .addUserOption(option =>
                option.setName('العضو')
                    .setDescription('العضو المراد ترقيته')
                    .setRequired(true))
            .addIntegerOption(option =>
                option.setName('النقاط')
                    .setDescription('عدد النقاط المراد إضافتها')
                    .setRequired(true)),
        
        new SlashCommandBuilder()
            .setName('تخفيض')
            .setDescription('تخفيض درجة عضو')
            .addUserOption(option =>
                option.setName('العضو')
                    .setDescription('العضو المراد تخفيض درجته')
                    .setRequired(true))
            .addIntegerOption(option =>
                option.setName('النقاط')
                    .setDescription('عدد النقاط المراد خصمها')
                    .setRequired(true)),
        
        new SlashCommandBuilder()
            .setName('إنذار')
            .setDescription('إعطاء إنذار لعضو')
            .addUserOption(option =>
                option.setName('العضو')
                    .setDescription('العضو المراد إنذاره')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('السبب')
                    .setDescription('سبب الإنذار')
                    .setRequired(true)),
        
        // أوامر الرتب الجديدة
        new SlashCommandBuilder()
            .setName('رتبتي')
            .setDescription('عرض رتبتك الحالية'),
        
        new SlashCommandBuilder()
            .setName('ترقية_فريق')
            .setDescription('ترقية عضو في فريق High Staff Team (خاص بـ CEO/COO)')
            .addUserOption(option =>
                option.setName('العضو')
                    .setDescription('العضو المراد ترقيته')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('الرتبة_الجديدة')
                    .setDescription('الرتبة الجديدة')
                    .setRequired(true)
                    .addChoices(
                        { name: 'General Manager', value: 'GENERAL_MANAGER' },
                        { name: 'Higher Management', value: 'HIGHER_MANAGEMENT' },
                        { name: 'President', value: 'PRESIDENT' },
                        { name: 'Vice President', value: 'VICE_PRESIDENT' },
                        { name: 'Lead Admin', value: 'LEAD_ADMIN' },
                        { name: 'Senior Admin', value: 'SENIOR_ADMIN' }
                    )),
        
        new SlashCommandBuilder()
            .setName('مساعدة')
            .setDescription('منح نقاط مساعدة لعضو')
            .addUserOption(option =>
                option.setName('العضو')
                    .setDescription('العضو الذي قدم المساعدة')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('وصف')
                    .setDescription('وصف المساعدة المقدمة')
                    .setRequired(true)),
        
        new SlashCommandBuilder()
            .setName('نقاط_المساعدة')
            .setDescription('عرض نقاط المساعدة')
            .addUserOption(option =>
                option.setName('العضو')
                    .setDescription('العضو المراد عرض نقاطه (اختياري)')
                    .setRequired(false)),
        
        // أوامر أخرى
        new SlashCommandBuilder()
            .setName('الترتيب')
            .setDescription('عرض ترتيب الأعضاء حسب النقاط'),
        
        new SlashCommandBuilder()
            .setName('إحصائيات')
            .setDescription('عرض إحصائيات عضو')
            .addUserOption(option =>
                option.setName('العضو')
                    .setDescription('العضو المراد عرض إحصائياته')
                    .setRequired(false)),
        
        new SlashCommandBuilder()
            .setName('قائمة_الرتب')
            .setDescription('عرض جميع الرتب المؤهلة والأعضاء الحاملين لها')
    ];

    try {
        console.log('Starting Register commands...');
        for (const guild of client.guilds.cache.values()) {
            await guild.commands.set(commands);
        }
        console.log('✅ All Commands Has been registered!');
    } catch (error) {
        console.error('Error in commands registering:', error);
    }
});

// Slash command handler
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, user, guild } = interaction;
    const userId = user.id;
    
    initUser(userId);

    try {
        switch (commandName) {
            case 'حضور':
                await handleCheckIn(interaction);
                break;
            case 'انصراف':
                await handleCheckOut(interaction);
                break;
            case 'نقاطي':
                await handleMyPoints(interaction);
                break;
            case 'ترقية':
                await handlePromote(interaction);
                break;
            case 'تخفيض':
                await handleDemote(interaction);
                break;
            case 'إنذار':
                await handleWarn(interaction);
                break;
            case 'رتبتي':
                await handleMyRank(interaction);
                break;
            case 'ترقية_فريق':
                await handleHighStaffPromotion(interaction);
                break;
            case 'مساعدة':
                await handleHelpPoints(interaction);
                break;
            case 'نقاط_المساعدة':
                await handleShowHelpPoints(interaction);
                break;
            case 'الترتيب':
                await handleLeaderboard(interaction);
                break;
            case 'إحصائيات':
                await handleStats(interaction);
                break;
            case 'قائمة_الرتب':
                await handleRanksList(interaction);
                break;
        }
    } catch (error) {
        console.error('خطأ في معالجة الأمر:', error);
        await interaction.reply({ 
            content: '❌ حدث خطأ في معالجة الأمر. يرجى المحاولة مرة أخرى.',
            ephemeral: true 
        });
    }
});

// Handle check-in
async function handleCheckIn(interaction) {
    const userId = interaction.user.id;
    const user = userData[userId];
    
    if (user.isCheckedIn) {
        return await interaction.reply({
            content: '❌ أنت مسجل حضورك بالفعل!',
            ephemeral: true
        });
    }
    
    const now = new Date();
    const today = now.toDateString();
    
    // تحديث بيانات الحضور
    user.isCheckedIn = true;
    user.checkInTime = now.toISOString();
    user.totalAttendance += 1;
    
    // حساب streak
    if (user.lastAttendance) {
        const lastDate = new Date(user.lastAttendance);
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (lastDate.toDateString() === yesterday.toDateString()) {
            user.currentStreak += 1;
        } else if (lastDate.toDateString() !== today) {
            user.currentStreak = 1;
        }
    } else {
        user.currentStreak = 1;
    }
    
    user.lastAttendance = today;
    
    // إضافة نقاط (10 نقاط أساسية + bonus للـ streak)
    let pointsGained = 10;
    if (user.currentStreak >= 7) pointsGained += 5; // مكافأة الأسبوع
    if (user.currentStreak >= 30) pointsGained += 10; // مكافأة الشهر
    
    user.points += pointsGained;
    const leveledUp = checkLevelUp(userId);
    
    saveData();
    
    const embed = new EmbedBuilder()
        .setTitle('✅ تم تسجيل الحضور')
        .setColor('#00FF00')
        .addFields(
            { name: '⏰ الوقت', value: now.toLocaleString('ar-EG'), inline: true },
            { name: '🎯 النقاط المكتسبة', value: `+${pointsGained}`, inline: true },
            { name: '💰 إجمالي النقاط', value: user.points.toString(), inline: true },
            { name: '🔥 سلسلة الحضور', value: `${user.currentStreak} يوم`, inline: true },
            { name: '📊 إجمالي الحضور', value: user.totalAttendance.toString(), inline: true }
        )
        .setFooter({ text: 'نظام الحضور والانصراف' })
        .setTimestamp();
    
    if (leveledUp) {
        embed.addFields({ 
            name: '🎉 ترقية!', 
            value: `تهانينا! وصلت لمستوى ${user.level}`, 
            inline: false 
        });
    }
    
    await interaction.reply({ embeds: [embed] });
}

// Handle check-out
async function handleCheckOut(interaction) {
    const userId = interaction.user.id;
    const user = userData[userId];
    
    if (!user.isCheckedIn) {
        return await interaction.reply({
            content: '❌ لم تسجل حضورك بعد!',
            ephemeral: true
        });
    }
    
    const now = new Date();
    const checkInTime = new Date(user.checkInTime);
    const duration = Math.floor((now - checkInTime) / (1000 * 60)); // بالدقائق
    
    // حساب نقاط إضافية على حسب مدة الحضور
    let bonusPoints = 0;
    if (duration >= 60) bonusPoints += 5; // ساعة واحدة
    if (duration >= 240) bonusPoints += 10; // 4 ساعات
    if (duration >= 480) bonusPoints += 15; // 8 ساعات
    
    user.points += bonusPoints;
    user.isCheckedIn = false;
    user.checkInTime = null;
    
    const leveledUp = checkLevelUp(userId);
    saveData();
    
    const embed = new EmbedBuilder()
        .setTitle('📤 تم تسجيل الانصراف')
        .setColor('#FF6B6B')
        .addFields(
            { name: '⏰ وقت الانصراف', value: now.toLocaleString('ar-EG'), inline: true },
            { name: '⏱️ مدة الحضور', value: `${Math.floor(duration / 60)} ساعة ${duration % 60} دقيقة`, inline: true },
            { name: '🎯 نقاط إضافية', value: `+${bonusPoints}`, inline: true },
            { name: '💰 إجمالي النقاط', value: user.points.toString(), inline: true }
        )
        .setFooter({ text: 'نظام الحضور والانصراف' })
        .setTimestamp();
    
    if (leveledUp) {
        embed.addFields({ 
            name: '🎉 ترقية!', 
            value: `تهانينا! وصلت لمستوى ${user.level}`, 
            inline: false 
        });
    }
    
    await interaction.reply({ embeds: [embed] });
}

// Handle my points
async function handleMyPoints(interaction) {
    const userId = interaction.user.id;
    const user = userData[userId];
    const userRank = getUserRank(user.points);
    const helpData = helpPoints[userId];
    
    const embed = new EmbedBuilder()
        .setTitle(`📊 إحصائياتك - ${interaction.user.displayName}`)
        .setColor(userRank.color)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: '💰 النقاط', value: user.points.toString(), inline: true },
            { name: '🎚️ المستوى', value: user.level.toString(), inline: true },
            { name: `${userRank.emoji} الرتبة`, value: userRank.name, inline: true },
            { name: '📊 إجمالي الحضور', value: user.totalAttendance.toString(), inline: true },
            { name: '🔥 سلسلة الحضور', value: `${user.currentStreak} يوم`, inline: true },
            { name: '⚠️ الإنذارات', value: user.warnings.toString(), inline: true },
            { name: '🆘 نقاط المساعدة', value: helpData.totalHelpPoints.toString(), inline: true },
            { name: '🤝 عدد المساعدات', value: helpData.helpCount.toString(), inline: true }
        )
        .setFooter({ text: 'نظام إدارة النقاط' })
        .setTimestamp();
    
    if (user.isCheckedIn) {
        const checkInTime = new Date(user.checkInTime);
        const duration = Math.floor((Date.now() - checkInTime) / (1000 * 60));
        embed.addFields({ 
            name: '🟢 الحالة', 
            value: `متصل منذ ${Math.floor(duration / 60)} ساعة ${duration % 60} دقيقة`, 
            inline: false 
        });
    } else {
        embed.addFields({ 
            name: '🔴 الحالة', 
            value: 'غير متصل', 
            inline: false 
        });
    }
    
    await interaction.reply({ embeds: [embed] });
}

// Handle promote - continuing from where it left off
async function handlePromote(interaction) {
    const member = interaction.member;
    
    // التحقق من الصلاحيات
    const highestRank = getHighestRank(member);
    if (!highestRank || !isQualifiedRank(highestRank.id)) {
        return await interaction.reply({
            content: '❌ ليس لديك صلاحيات كافية لاستخدام هذا الأمر.',
            ephemeral: true
        });
    }
    
    const targetUser = interaction.options.getUser('العضو');
    const points = interaction.options.getInteger('النقاط');
    
    if (points <= 0) {
        return await interaction.reply({
            content: '❌ عدد النقاط يجب أن يكون أكبر من صفر.',
            ephemeral: true
        });
    }
    
    const targetId = targetUser.id;
    initUser(targetId);
    
    userData[targetId].points += points;
    const leveledUp = checkLevelUp(targetId);
    saveData();
    
    const embed = new EmbedBuilder()
        .setTitle('⬆️ ترقية عضو')
        .setColor('#00FF00')
        .setDescription(`تم ترقية ${targetUser.displayName} بنجاح!`)
        .addFields(
            { name: '🎯 النقاط المضافة', value: points.toString(), inline: true },
            { name: '💰 إجمالي النقاط', value: userData[targetId].points.toString(), inline: true },
            { name: '👤 بواسطة', value: interaction.user.displayName, inline: true }
        )
        .setFooter({ text: 'نظام الترقيات' })
        .setTimestamp();
    
    if (leveledUp) {
        embed.addFields({ 
            name: '🎉 ترقية مستوى!', 
            value: `وصل لمستوى ${userData[targetId].level}`, 
            inline: false 
        });
    }
    
    await interaction.reply({ embeds: [embed] });
    
    // إرسال لوج
    const logEmbed = new EmbedBuilder()
        .setTitle('📈 ترقية عضو')
        .setColor('#00FF00')
        .addFields(
            { name: 'العضو المرقى', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
            { name: 'النقاط المضافة', value: points.toString(), inline: true },
            { name: 'بواسطة', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true }
        )
        .setTimestamp();
    
    await sendLog(interaction.guild, logEmbed);
}

// Handle demote
async function handleDemote(interaction) {
    const member = interaction.member;
    
    // التحقق من الصلاحيات
    const highestRank = getHighestRank(member);
    if (!highestRank || !isQualifiedRank(highestRank.id)) {
        return await interaction.reply({
            content: '❌ ليس لديك صلاحيات كافية لاستخدام هذا الأمر.',
            ephemeral: true
        });
    }
    
    const targetUser = interaction.options.getUser('العضو');
    const points = interaction.options.getInteger('النقاط');
    
    if (points <= 0) {
        return await interaction.reply({
            content: '❌ عدد النقاط يجب أن يكون أكبر من صفر.',
            ephemeral: true
        });
    }
    
    const targetId = targetUser.id;
    initUser(targetId);
    
    userData[targetId].points = Math.max(0, userData[targetId].points - points);
    userData[targetId].level = calculateLevelFromPoints(userData[targetId].points);
    saveData();
    
    const embed = new EmbedBuilder()
        .setTitle('⬇️ تخفيض درجة عضو')
        .setColor('#FF6B6B')
        .setDescription(`تم تخفيض درجة ${targetUser.displayName}`)
        .addFields(
            { name: '🎯 النقاط المخصومة', value: points.toString(), inline: true },
            { name: '💰 إجمالي النقاط', value: userData[targetId].points.toString(), inline: true },
            { name: '👤 بواسطة', value: interaction.user.displayName, inline: true }
        )
        .setFooter({ text: 'نظام التخفيضات' })
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
    
    // إرسال لوج
    const logEmbed = new EmbedBuilder()
        .setTitle('📉 تخفيض درجة عضو')
        .setColor('#FF6B6B')
        .addFields(
            { name: 'العضو', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
            { name: 'النقاط المخصومة', value: points.toString(), inline: true },
            { name: 'بواسطة', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true }
        )
        .setTimestamp();
    
    await sendLog(interaction.guild, logEmbed);
}

// Handle warn
async function handleWarn(interaction) {
    const member = interaction.member;
    
    // التحقق من الصلاحيات
    const highestRank = getHighestRank(member);
    if (!highestRank || !isQualifiedRank(highestRank.id)) {
        return await interaction.reply({
            content: '❌ ليس لديك صلاحيات كافية لاستخدام هذا الأمر.',
            ephemeral: true
        });
    }
    
    const targetUser = interaction.options.getUser('العضو');
    const reason = interaction.options.getString('السبب');
    
    const targetId = targetUser.id;
    initUser(targetId);
    
    userData[targetId].warnings += 1;
    userData[targetId].points = Math.max(0, userData[targetId].points - 20); // خصم 20 نقطة للإنذار
    userData[targetId].level = calculateLevelFromPoints(userData[targetId].points);
    saveData();
    
    const embed = new EmbedBuilder()
        .setTitle('⚠️ إنذار عضو')
        .setColor('#FFA500')
        .setDescription(`تم إنذار ${targetUser.displayName}`)
        .addFields(
            { name: '📝 السبب', value: reason, inline: false },
            { name: '⚠️ عدد الإنذارات', value: userData[targetId].warnings.toString(), inline: true },
            { name: '💰 النقاط الحالية', value: userData[targetId].points.toString(), inline: true },
            { name: '👤 بواسطة', value: interaction.user.displayName, inline: true }
        )
        .setFooter({ text: 'نظام الإنذارات' })
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
    
    // إرسال لوج
    const logEmbed = new EmbedBuilder()
        .setTitle('⚠️ إنذار عضو')
        .setColor('#FFA500')
        .addFields(
            { name: 'العضو', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
            { name: 'السبب', value: reason, inline: false },
            { name: 'عدد الإنذارات', value: userData[targetId].warnings.toString(), inline: true },
            { name: 'بواسطة', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true }
        )
        .setTimestamp();
    
    await sendLog(interaction.guild, logEmbed);
}

// Handle my rank
async function handleMyRank(interaction) {
    const member = interaction.member;
    const highestRank = getHighestRank(member);
    
    const embed = new EmbedBuilder()
        .setTitle('🎖️ رتبتك الحالية')
        .setColor('#4B0082')
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));
    
    if (highestRank) {
        embed.setDescription(`رتبتك الحالية: ${highestRank.emoji} **${highestRank.name}**`)
            .addFields(
                { name: 'مستوى الرتبة', value: highestRank.level.toString(), inline: true },
                { name: 'الرمز', value: highestRank.emoji, inline: true }
            );
    } else {
        embed.setDescription('❌ لا تحمل أي رتبة مؤهلة حالياً');
    }
    
    embed.setFooter({ text: 'نظام الرتب' })
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

// Handle high staff promotion
async function handleHighStaffPromotion(interaction) {
    const member = interaction.member;
    
    // التحقق من صلاحيات CEO/COO فقط
    if (!canPromoteHighStaff(member)) {
        return await interaction.reply({
            content: '❌ هذا الأمر مخصص فقط لـ Server CEO و Server COO.',
            ephemeral: true
        });
    }
    
    const targetUser = interaction.options.getUser('العضو');
    const newRankId = interaction.options.getString('الرتبة_الجديدة');
    
    const targetMember = interaction.guild.members.cache.get(targetUser.id);
    if (!targetMember) {
        return await interaction.reply({
            content: '❌ لم يتم العثور على العضو في الخادم.',
            ephemeral: true
        });
    }
    
    const newRoleId = RANKS[newRankId];
    if (!newRoleId) {
        return await interaction.reply({
            content: '❌ معرف الرتبة غير صحيح.',
            ephemeral: true
        });
    }
    
    const newRole = interaction.guild.roles.cache.get(newRoleId);
    if (!newRole) {
        return await interaction.reply({
            content: '❌ لم يتم العثور على الرتبة في الخادم.',
            ephemeral: true
        });
    }
    
    try {
        await targetMember.roles.add(newRole);
        
        const rankInfo = RANK_HIERARCHY.find(r => r.id === newRankId);
        
        const embed = new EmbedBuilder()
            .setTitle('🎖️ ترقية في فريق High Staff Team')
            .setColor('#4B0082')
            .setDescription(`تم ترقية ${targetUser.displayName} بنجاح!`)
            .addFields(
                { name: '🆕 الرتبة الجديدة', value: `${rankInfo.emoji} ${rankInfo.name}`, inline: true },
                { name: '👤 بواسطة', value: interaction.user.displayName, inline: true }
            )
            .setFooter({ text: 'نظام ترقيات High Staff Team' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
        
        // إرسال لوج
        const logEmbed = new EmbedBuilder()
            .setTitle('🎖️ ترقية High Staff Team')
            .setColor('#4B0082')
            .addFields(
                { name: 'العضو المرقى', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                { name: 'الرتبة الجديدة', value: `${rankInfo.emoji} ${rankInfo.name}`, inline: true },
                { name: 'بواسطة', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true }
            )
            .setTimestamp();
        
        await sendLog(interaction.guild, logEmbed);
        
    } catch (error) {
        console.error('خطأ في ترقية العضو:', error);
        await interaction.reply({
            content: '❌ حدث خطأ أثناء ترقية العضو.',
            ephemeral: true
        });
    }
}

// Handle help points
async function handleHelpPoints(interaction) {
    const member = interaction.member;
    
    // التحقق من الصلاحيات
    const highestRank = getHighestRank(member);
    if (!highestRank || !isQualifiedRank(highestRank.id)) {
        return await interaction.reply({
            content: '❌ ليس لديك صلاحيات كافية لاستخدام هذا الأمر.',
            ephemeral: true
        });
    }
    
    const targetUser = interaction.options.getUser('العضو');
    const description = interaction.options.getString('وصف');
    
    const targetId = targetUser.id;
    initUser(targetId);
    
    // إضافة نقاط مساعدة (5 نقاط لكل مساعدة)
    const helpPointsToAdd = 5;
    helpPoints[targetId].totalHelpPoints += helpPointsToAdd;
    helpPoints[targetId].helpCount += 1;
    helpPoints[targetId].lastHelpDate = new Date().toISOString();
    
    // إضافة نقاط عادية أيضاً
    userData[targetId].points += helpPointsToAdd;
    const leveledUp = checkLevelUp(targetId);
    
    saveData();
    
    const embed = new EmbedBuilder()
        .setTitle('🆘 منح نقاط مساعدة')
        .setColor('#32CD32')
        .setDescription(`تم منح ${targetUser.displayName} نقاط مساعدة!`)
        .addFields(
            { name: '📝 وصف المساعدة', value: description, inline: false },
            { name: '🎯 النقاط الممنوحة', value: helpPointsToAdd.toString(), inline: true },
            { name: '🆘 إجمالي نقاط المساعدة', value: helpPoints[targetId].totalHelpPoints.toString(), inline: true },
            { name: '🤝 عدد المساعدات', value: helpPoints[targetId].helpCount.toString(), inline: true },
            { name: '👤 بواسطة', value: interaction.user.displayName, inline: true }
        )
        .setFooter({ text: 'نظام نقاط المساعدة' })
        .setTimestamp();
    
    if (leveledUp) {
        embed.addFields({ 
            name: '🎉 ترقية مستوى!', 
            value: `وصل لمستوى ${userData[targetId].level}`, 
            inline: false 
        });
    }
    
    await interaction.reply({ embeds: [embed] });
    
    // إرسال لوج
    const logEmbed = new EmbedBuilder()
        .setTitle('🆘 منح نقاط مساعدة')
        .setColor('#32CD32')
        .addFields(
            { name: 'العضو', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
            { name: 'وصف المساعدة', value: description, inline: false },
            { name: 'النقاط الممنوحة', value: helpPointsToAdd.toString(), inline: true },
            { name: 'بواسطة', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true }
        )
        .setTimestamp();
    
    await sendLog(interaction.guild, logEmbed);
}

// Handle show help points
async function handleShowHelpPoints(interaction) {
    const targetUser = interaction.options.getUser('العضو') || interaction.user;
    const targetId = targetUser.id;
    
    initUser(targetId);
    
    const helpData = helpPoints[targetId];
    const userData_user = userData[targetId];
    
    const embed = new EmbedBuilder()
        .setTitle(`🆘 نقاط المساعدة - ${targetUser.displayName}`)
        .setColor('#32CD32')
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: '🆘 إجمالي نقاط المساعدة', value: helpData.totalHelpPoints.toString(), inline: true },
            { name: '🤝 عدد المساعدات', value: helpData.helpCount.toString(), inline: true },
            { name: '💰 النقاط الإجمالية', value: userData_user.points.toString(), inline: true }
        );
    
    if (helpData.lastHelpDate) {
        const lastHelpDate = new Date(helpData.lastHelpDate);
        embed.addFields({ 
            name: '📅 آخر مساعدة', 
            value: lastHelpDate.toLocaleDateString('ar-EG'), 
            inline: true 
        });
    }
    
    embed.setFooter({ text: 'نظام نقاط المساعدة' })
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

// Handle leaderboard
async function handleLeaderboard(interaction) {
    const sortedUsers = Object.entries(userData)
        .sort(([,a], [,b]) => b.points - a.points)
        .slice(0, 10);
    
    if (sortedUsers.length === 0) {
        return await interaction.reply({
            content: '❌ لا توجد بيانات متاحة حالياً.',
            ephemeral: true
        });
    }
    
    const embed = new EmbedBuilder()
        .setTitle('🏆 ترتيب الأعضاء')
        .setColor('#FFD700')
        .setDescription('أفضل 10 أعضاء حسب النقاط');
    
    let description = '';
    for (let i = 0; i < sortedUsers.length; i++) {
        const [userId, user] = sortedUsers[i];
        const discordUser = await client.users.fetch(userId).catch(() => null);
        const username = discordUser ? discordUser.displayName : 'مستخدم غير معروف';
        
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        description += `${medal} **${username}** - ${user.points} نقطة (مستوى ${user.level})\n`;
    }
    
    embed.setDescription(description)
        .setFooter({ text: 'نظام الترتيب' })
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

// Handle stats
async function handleStats(interaction) {
    const targetUser = interaction.options.getUser('العضو') || interaction.user;
    const targetId = targetUser.id;
    
    initUser(targetId);
    
    const user = userData[targetId];
    const helpData = helpPoints[targetId];
    const userRank = getUserRank(user.points);
    
    // الحصول على رتبة Discord
    const targetMember = interaction.guild.members.cache.get(targetId);
    const discordRank = targetMember ? getHighestRank(targetMember) : null;
    
    const embed = new EmbedBuilder()
        .setTitle(`📊 إحصائيات مفصلة - ${targetUser.displayName}`)
        .setColor(userRank.color)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: '💰 النقاط', value: user.points.toString(), inline: true },
            { name: '🎚️ المستوى', value: user.level.toString(), inline: true },
            { name: `${userRank.emoji} رتبة النقاط`, value: userRank.name, inline: true },
            { name: '📊 إجمالي الحضور', value: user.totalAttendance.toString(), inline: true },
            { name: '🔥 أطول سلسلة حضور', value: `${user.currentStreak} يوم`, inline: true },
            { name: '⚠️ الإنذارات', value: user.warnings.toString(), inline: true },
            { name: '🆘 نقاط المساعدة', value: helpData.totalHelpPoints.toString(), inline: true },
            { name: '🤝 عدد المساعدات', value: helpData.helpCount.toString(), inline: true }
        );
    
    if (discordRank) {
        embed.addFields({ 
            name: '🎖️ رتبة Discord', 
            value: `${discordRank.emoji} ${discordRank.name}`, 
            inline: true 
        });
    }
    
    if (user.lastAttendance) {
        embed.addFields({ 
            name: '📅 آخر حضور', 
            value: user.lastAttendance, 
            inline: true 
        });
    }
    
    if (user.isCheckedIn) {
        const checkInTime = new Date(user.checkInTime);
        const duration = Math.floor((Date.now() - checkInTime) / (1000 * 60));
        embed.addFields({ 
            name: '🟢 الحالة الحالية', 
            value: `متصل منذ ${Math.floor(duration / 60)} ساعة ${duration % 60} دقيقة`, 
            inline: false 
        });
    } else {
        embed.addFields({ 
            name: '🔴 الحالة الحالية', 
            value: 'غير متصل', 
            inline: false 
        });
    }
    
    embed.setFooter({ text: 'الإحصائيات المفصلة' })
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

// Handle ranks list
async function handleRanksList(interaction) {
    const guild = interaction.guild;
    
    const embed = new EmbedBuilder()
        .setTitle('🎖️ قائمة الرتب المؤهلة')
        .setColor('#4B0082')
        .setDescription('جميع الرتب والأعضاء الحاملين لها');
    
    let description = '';
    
    for (const rank of RANK_HIERARCHY) {
        const roleId = RANKS[rank.id];
        if (!roleId || !isQualifiedRank(rank.id)) continue;
        
        const role = guild.roles.cache.get(roleId);
        if (!role) continue;
        
        const members = role.members;
        const memberCount = members.size;
        
        description += `\n${rank.emoji} **${rank.name}** (المستوى ${rank.level})\n`;
        description += `└ عدد الأعضاء: ${memberCount}\n`;
        
        if (memberCount > 0 && memberCount <= 5) {
            const memberNames = members.map(m => m.displayName).join(', ');
            description += `└ الأعضاء: ${memberNames}\n`;
        } else if (memberCount > 5) {
            const someMembers = members.first(3).map(m => m.displayName).join(', ');
            description += `└ بعض الأعضاء: ${someMembers}... و${memberCount - 3} آخرين\n`;
        }
    }
    
    if (description.length > 4096) {
        description = description.substring(0, 4000) + '\n... (القائمة مقطوعة)';
    }
    
    embed.setDescription(description)
        .setFooter({ text: 'قائمة الرتب المؤهلة' })
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

// Auto save data every 5 minutes
setInterval(() => {
    saveData();
    console.log('✅ Saved data automatically at', new Date().toLocaleTimeString());
}, 5 * 60 * 1000);

// Handle process termination
process.on('SIGINT', () => {
    console.log('💾 Save before get off');
    saveData();
    console.log('👋 Bot Is off');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('💾 Save before get off');
    saveData();
    console.log('👋 Bot Is off');
    process.exit(0);
});

// Login to Discord
client.login(TOKEN).catch(console.error);
