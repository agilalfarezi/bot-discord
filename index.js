import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

// ===================================================
// 🧠 Inisialisasi Client
// ===================================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ===================================================
// 💾 TRANSAKSI SECTION
// ===================================================
const transactionsFile = "./transactions.json";

function loadTransactions() {
  if (!fs.existsSync(transactionsFile))
    fs.writeFileSync(transactionsFile, "{}");
  return JSON.parse(fs.readFileSync(transactionsFile));
}
function saveTransactions(data) {
  fs.writeFileSync(transactionsFile, JSON.stringify(data, null, 2));
}

// ===================================================
// 💾 STOCK SECTION
// ===================================================
const stockFile = path.resolve("./stock/stock.json");

if (!fs.existsSync(stockFile)) {
  fs.writeFileSync(stockFile, JSON.stringify({ stock: 51497 }, null, 2));
  console.log("✅ File stock.json dibuat otomatis!");
}

function loadStock() {
  return JSON.parse(fs.readFileSync(stockFile, "utf8"));
}
function saveStock(stock) {
  fs.writeFileSync(stockFile, JSON.stringify(stock, null, 2));
}

// ===================================================
// ⚙️ SLASH COMMANDS
// ===================================================
const commands = [
  new SlashCommandBuilder()
    .setName("add_transaksi")
    .setDescription("Tambah transaksi customer (hanya admin)")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("Customer").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("item").setDescription("Nama barang").setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt.setName("harga").setDescription("Harga barang").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("total_transaksi")
    .setDescription("Lihat total transaksi kamu atau user lain (admin only)")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("User target").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("set_stock")
    .setDescription("Ubah jumlah stock robux (admin only)")
    .addIntegerOption((opt) =>
      opt
        .setName("jumlah")
        .setDescription("Jumlah stock baru (contoh: 52000)")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map((cmd) => cmd.toJSON());

// ===================================================
// 🚀 DEPLOY SLASH COMMANDS
// ===================================================
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );
    console.log("✅ Semua Slash Commands berhasil di-deploy!");
  } catch (error) {
    console.error("❌ Gagal deploy slash commands:", error);
  }
})();

// ===================================================
// 💬 COMMAND: !stock
// ===================================================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.content.toLowerCase() === "!stock") {
    const data = loadStock();

    const embed = new EmbedBuilder()
      .setTitle("📦 STOCK ROBUX")
      .setDescription(
        `**Stock robux tersedia saat ini:** R$ ${data.stock.toLocaleString(
          "id-ID"
        )}\n\n*Stock otomatis diupdate setiap 25 menit sekali.*`
      )
      .setColor("#00FF88");

    message.reply({ embeds: [embed] });
  }
});

// ===================================================
// ⚙️ HANDLER SLASH COMMANDS
// ===================================================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // ===========================================
  // 🔶 /add_transaksi
  // ===========================================
  if (interaction.commandName === "add_transaksi") {
    const transactions = loadTransactions();

    const user = interaction.options.getUser("user");
    const item = interaction.options.getString("item");
    const harga = interaction.options.getInteger("harga");
    const date = new Date().toLocaleString("id-ID", {
      dateStyle: "long",
      timeStyle: "short",
    });

    if (!transactions[user.id]) transactions[user.id] = [];
    transactions[user.id].push({ item, harga, date });
    saveTransactions(transactions);

    return interaction.reply(
      `✅ Transaksi berhasil ditambahkan untuk **${user.username}**:\n` +
        `> Barang: **${item}**\n> Harga: Rp ${harga.toLocaleString("id-ID")}`
    );
  }

  // ===========================================
  // 🔷 /total_transaksi
  // ===========================================
  if (interaction.commandName === "total_transaksi") {
    const transactions = loadTransactions();
    const isAdmin = interaction.member.permissions.has(
      PermissionFlagsBits.Administrator
    );
    const targetUser = interaction.options.getUser("user");

    // 🔒 Buyer/member hanya bisa lihat punyanya sendiri
    if (!isAdmin) {
      if (targetUser) {
        return interaction.reply({
          content: "🚫 Kamu tidak bisa melihat transaksi orang lain!",
          ephemeral: true,
        });
      }

      const data = transactions[interaction.user.id];
      if (!data || data.length === 0) {
        return interaction.reply({
          content: "📭 Kamu belum punya transaksi.",
          ephemeral: true,
        });
      }

      let total = 0;
      const list = data
        .map((t, i) => {
          total += t.harga;
          return `**${i + 1}.** ${t.item}\nHarga: Rp ${t.harga.toLocaleString(
            "id-ID"
          )}\nTanggal: ${t.date}`;
        })
        .join("\n\n");

      const embed = new EmbedBuilder()
        .setTitle(`📦 List Transaksi Kamu`)
        .setDescription(list)
        .addFields({
          name: "💰 Total Transaksi",
          value: `Rp ${total.toLocaleString("id-ID")}`,
        })
        .setColor("#00FF88");

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // 🧩 Admin wajib isi user (tidak bisa lihat diri sendiri)
    if (isAdmin && !targetUser) {
      return interaction.reply({
        content:
          "⚠️ Admin harus memilih user untuk melihat total transaksinya.",
        ephemeral: true,
      });
    }

    const data = transactions[targetUser.id];
    if (!data || data.length === 0) {
      return interaction.reply({
        content: `📭 ${targetUser.username} belum punya transaksi.`,
        ephemeral: true,
      });
    }

    let total = 0;
    const list = data
      .map((t, i) => {
        total += t.harga;
        return `**${i + 1}.** ${t.item}\nHarga: Rp ${t.harga.toLocaleString(
          "id-ID"
        )}\nTanggal: ${t.date}`;
      })
      .join("\n\n");

    const embed = new EmbedBuilder()
      .setTitle(`📦 List Transaksi - ${targetUser.username}`)
      .setDescription(list)
      .addFields({
        name: "💰 Total Transaksi",
        value: `Rp ${total.toLocaleString("id-ID")}`,
      })
      .setColor("#00FF88");

    return interaction.reply({ embeds: [embed], ephemeral: false });
  }

  // ===========================================
  // 🟢 /set_stock
  // ===========================================
  if (interaction.commandName === "set_stock") {
    if (
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      return interaction.reply({
        content: "🚫 Hanya admin yang bisa mengubah stock!",
        ephemeral: true,
      });
    }

    const jumlah = interaction.options.getInteger("jumlah");
    const data = loadStock();
    data.stock = jumlah;
    saveStock(data);

    return interaction.reply(
      `✅ Stock berhasil diubah menjadi: **R$ ${jumlah.toLocaleString(
        "id-ID"
      )}**`
    );
  }
});

// ===================================================
// 🟢 BOT READY
// ===================================================
client.once("ready", () => {
  console.log(`✅ Bot aktif sebagai ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
