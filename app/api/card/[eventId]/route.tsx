import { ImageResponse } from 'next/og';
import { ConversionCardImage } from '@/components/card/ConversionCardImage';
import { db } from '@/lib/db/client';
import { cardFonts } from '@/lib/ui/card-fonts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ eventId: string }> };

/** OG card for a chronicle event: conversion, schism or boss (GAME.md §11). Heresy events have none. */
export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const { eventId } = await params;
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(eventId)) return new Response('Not found', { status: 404 });
  const client = await db();
  const card = await client.conversionCard.findUnique({ where: { eventId }, include: { event: { select: { faith: { select: { hidden: true } } } } } });
  if (!card || card.event.faith?.hidden) return new Response('Not found', { status: 404 });
  const fonts = await cardFonts();
  return new ImageResponse(<ConversionCardImage card={{ ...card, variant: card.variant }} />, {
    width: 1200,
    height: 630,
    fonts,
    headers: { 'cache-control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800' },
  });
}
