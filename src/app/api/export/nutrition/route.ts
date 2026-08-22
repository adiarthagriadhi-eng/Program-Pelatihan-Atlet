import { NextResponse } from "next/server";
import { buildNutritionExport } from "@/lib/nutrition-export";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const athleteIdParam = searchParams.get("athleteId");

  let athleteIds: number[] | undefined;
  if (athleteIdParam) {
    const id = Number(athleteIdParam);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { status: "error", message: "athleteId tidak valid." },
        { status: 400 }
      );
    }
    athleteIds = [id];
  }

  try {
    const result = await buildNutritionExport(athleteIds);
    return NextResponse.json({ status: "ok", ...result });
  } catch (error) {
    console.error("Gagal membangun ekspor nutrisi:", error);
    return NextResponse.json(
      { status: "error", message: "Gagal terhubung ke database. Coba lagi." },
      { status: 500 }
    );
  }
}
