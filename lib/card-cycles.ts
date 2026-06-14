import type { Card } from "./types";

type CardCycleDefault = {
  card_name: string;
  statement_cycle: string;
  statement_cut_day: number;
  due_day: number;
  aliases: string[];
};

export const CARD_CYCLE_DEFAULTS: CardCycleDefault[] = [
  { card_name: "KTC", statement_cycle: "cut 17 / due 1", statement_cut_day: 17, due_day: 1, aliases: ["KTC", "KTC statement"] },
  { card_name: "Firstchoice", statement_cycle: "cut 12 / due 2", statement_cut_day: 12, due_day: 2, aliases: ["FirstChoice", "Firstchoice", "Firstchoice statement"] },
  { card_name: "T1 Central", statement_cycle: "cut 18 / due 7", statement_cut_day: 18, due_day: 7, aliases: ["T1 Central", "The1 Central", "The1 Central Garmin"] },
  { card_name: "BBL", statement_cycle: "cut 7 / due 22", statement_cut_day: 7, due_day: 22, aliases: ["BBL", "BBL Credit"] },
  { card_name: "KBANK", statement_cycle: "cut 20 / due 5", statement_cut_day: 20, due_day: 5, aliases: ["KBANK", "KBANK Card", "KBank", "KBank card", "KBANK card installments"] },
  { card_name: "Shopee", statement_cycle: "cut 25 / due 5", statement_cut_day: 25, due_day: 5, aliases: ["Shopee", "SPayLater", "Shopee SPayLater", "Shopee : SPayLater"] },
];

function cardKey(cardName?: string): string {
  return String(cardName ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

const cardAliasMap = new Map<string, CardCycleDefault>();
for (const cycle of CARD_CYCLE_DEFAULTS) {
  cardAliasMap.set(cardKey(cycle.card_name), cycle);
  for (const alias of cycle.aliases) {
    cardAliasMap.set(cardKey(alias), cycle);
  }
}

export function findDefaultCardCycle(cardName?: string): CardCycleDefault | undefined {
  return cardAliasMap.get(cardKey(cardName));
}

export function canonicalCardName(cardName?: string): string {
  return findDefaultCardCycle(cardName)?.card_name ?? String(cardName ?? "");
}

export function sameCardName(left?: string, right?: string): boolean {
  return cardKey(canonicalCardName(left)) === cardKey(canonicalCardName(right));
}

export function normalizeCard(card: Card): Card {
  const cycle = findDefaultCardCycle(card.card_name);
  if (!cycle) {
    return {
      ...card,
      statement_cut_day: card.statement_cut_day ?? 1,
    };
  }

  return {
    ...card,
    card_name: cycle.card_name,
    statement_cycle: card.statement_cycle && card.statement_cycle !== "monthly statement" ? card.statement_cycle : cycle.statement_cycle,
    statement_cut_day: card.statement_cut_day || cycle.statement_cut_day,
    due_day: card.due_day || cycle.due_day,
  };
}

export function defaultCards(): Card[] {
  return CARD_CYCLE_DEFAULTS.map((cycle) => ({
    card_name: cycle.card_name,
    statement_cycle: cycle.statement_cycle,
    statement_cut_day: cycle.statement_cut_day,
    due_day: cycle.due_day,
    current_balance: 0,
  }));
}

export function mergeDefaultCards(cards: Card[] = []): Card[] {
  const normalized = cards.map(normalizeCard);
  const merged = [...normalized];

  for (const card of defaultCards()) {
    if (!merged.some((item) => sameCardName(item.card_name, card.card_name))) {
      merged.push(card);
    }
  }

  return merged;
}
