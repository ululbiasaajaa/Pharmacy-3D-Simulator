import { describe, expect, it } from 'vitest';
import {
  acceptCompoundingRequest,
  createCompoundingOrder,
  evaluateCompounding,
  findRecipe,
  startCompounding,
  submitCompounding,
} from '@/domain/compounding';
import { callNextPatient, spawnPatient } from '@/domain/patients';
import { stockOf } from '@/domain/inventory';
import { completeSale } from '@/domain/pos';
import type { CompoundingAttempt } from '@/domain/types';
import { newState } from '../helpers';

const recipe = findRecipe('rcp-zno-salep')!;

function perfect(orderId: string): CompoundingAttempt {
  return {
    orderId,
    weighed: { zno: 5, 'vas-alb': 45 },
    stepsDone: [...recipe.steps],
    grindQuality: 1,
    mixQuality: 1,
    container: recipe.container,
    labelText: recipe.labelInstructions,
  };
}

describe('Evaluasi peracikan', () => {
  it('racikan sempurna lulus dengan nilai 100', () => {
    const ev = evaluateCompounding(recipe, perfect('x'));
    expect(ev.passed).toBe(true);
    expect(ev.score).toBe(100);
  });

  it('penimbangan di luar toleransi gagal', () => {
    const ev = evaluateCompounding(recipe, { ...perfect('x'), weighed: { zno: 6, 'vas-alb': 45 } });
    expect(ev.passed).toBe(false);
    expect(ev.feedback.join(' ')).toMatch(/toleransi/);
  });

  it('urutan salah mengurangi nilai; wadah salah gagal', () => {
    const swapped = evaluateCompounding(recipe, { ...perfect('x'), stepsDone: ['weigh', 'mix', 'grind', 'container', 'label'] });
    expect(swapped.score).toBeLessThan(100);
    const wrongContainer = evaluateCompounding(recipe, { ...perfect('x'), container: 'Kertas puyer' });
    expect(wrongContainer.passed).toBe(false);
  });
});

describe('Alur peracikan', () => {
  it('pesanan pasien → racik → kasir; bahan berkurang', () => {
    const s = newState('learning', { open: true });
    const p = spawnPatient(s, { category: 'compounding', recipeId: recipe.id, scripted: true })!;
    callNextPatient(s, p.id);
    const acc = acceptCompoundingRequest(s, p.id);
    expect(acc.ok).toBe(true);
    const order = acc.ok ? acc.value! : null!;
    expect(p.status).toBe('awaiting');
    const zno = stockOf(s, 'zno', 'any');
    expect(startCompounding(s, order.id).ok).toBe(true);
    const r = submitCompounding(s, perfect(order.id));
    expect(r.ok && r.value!.passed).toBe(true);
    expect(stockOf(s, 'zno', 'any')).toBe(zno - 5);
    expect(p.status).toBe('checkout');
    expect(submitCompounding(s, perfect(order.id)).ok).toBe(false);
    const money = s.money;
    const sale = completeSale(s, p.saleId!, 'cash');
    expect(sale.ok).toBe(true);
    expect(s.money).toBe(money + recipe.price + 15_000);
    expect(s.stats.compoundingCompleted).toBe(1);
  });

  it('racikan gagal tetap memakai bahan dan dapat diulang', () => {
    const s = newState('learning', { open: true });
    const o = createCompoundingOrder(s, recipe.id);
    const id = o.ok ? o.value!.id : '';
    startCompounding(s, id);
    const zno = stockOf(s, 'zno', 'any');
    const r = submitCompounding(s, { ...perfect(id), weighed: { zno: 8, 'vas-alb': 45 } });
    expect(r.ok && r.value!.passed).toBe(false);
    expect(stockOf(s, 'zno', 'any')).toBe(zno - 8);
    const r2 = submitCompounding(s, perfect(id));
    expect(r2.ok && r2.value!.passed).toBe(true);
  });

  it('racikan serbuk terbagi membutuhkan peralatan lanjutan', () => {
    const s = newState('learning', { open: true });
    expect(createCompoundingOrder(s, 'rcp-puyer-vitc').ok).toBe(false);
  });
});
