const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccount.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function limpiarIVA() {
  console.log("🔍 Leyendo colección 'productos'...");
  const snap = await db.collection("productos").get();
  console.log(`📦 ${snap.size} productos encontrados.\n`);

  let actualizados = 0;
  let sinCambios = 0;

  for (const d of snap.docs) {
    const data = d.data();
    const tieneCampos =
      "ivaCompraDefault" in data ||
      "ivaCompraSelected" in data ||
      "ivaVentaDefault" in data ||
      "ivaVentaSelected" in data;

    if (!tieneCampos) {
      sinCambios++;
      continue;
    }

    await d.ref.update({
      ivaCompraDefault: admin.firestore.FieldValue.delete(),
      ivaCompraSelected: admin.firestore.FieldValue.delete(),
      ivaVentaDefault: admin.firestore.FieldValue.delete(),
      ivaVentaSelected: admin.firestore.FieldValue.delete(),
    });

    actualizados++;
    console.log(`✅ ${data.nombre || d.id}`);
  }

  console.log(`\n✔ Listo.`);
  console.log(`   Actualizados : ${actualizados}`);
  console.log(`   Sin cambios  : ${sinCambios}`);
  process.exit(0);
}

limpiarIVA().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});