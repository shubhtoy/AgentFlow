'use strict';

/**
 * FidelityReporter — builds structured fidelity reports.
 * No "skip" category. Every file maps to exactly one of:
 * native, on-demand, translated, preserved.
 */

const FIDELITY_ICONS = {
  native: '✅',
  'on-demand': '📋',
  translated: '🔄',
  preserved: '📁',
};

class FidelityReporter {
  /**
   * Build a fidelity report from export/import entries.
   * @param {string} platform - platform name
   * @param {'export'|'import'} direction
   * @param {Array<{source: string, target: string, fidelity: string, note?: string}>} entries
   * @returns {FidelityReport}
   */
  build(platform, direction, entries) {
    const summary = { native: 0, onDemand: 0, translated: 0, preserved: 0 };

    for (const entry of entries) {
      switch (entry.fidelity) {
        case 'native': summary.native++; break;
        case 'on-demand': summary.onDemand++; break;
        case 'translated': summary.translated++; break;
        case 'preserved': summary.preserved++; break;
      }
    }

    const markdown = this._buildMarkdown(platform, direction, entries, summary);

    return { platform, direction, entries, summary, markdown };
  }

  _buildMarkdown(platform, direction, entries, summary) {
    const lines = [
      `# Fidelity Report: ${platform} (${direction})`,
      '',
      `| Category | Count |`,
      `|---|---|`,
      `| ${FIDELITY_ICONS.native} Native | ${summary.native} |`,
      `| ${FIDELITY_ICONS['on-demand']} On-demand | ${summary.onDemand} |`,
      `| ${FIDELITY_ICONS.translated} Translated | ${summary.translated} |`,
      `| ${FIDELITY_ICONS.preserved} Preserved | ${summary.preserved} |`,
      `| **Total** | **${entries.length}** |`,
      '',
      '## Details',
      '',
      '| Source | Target | Fidelity | Note |',
      '|---|---|---|---|',
    ];

    for (const e of entries) {
      const icon = FIDELITY_ICONS[e.fidelity] || '';
      lines.push(`| ${e.source} | ${e.target || '—'} | ${icon} ${e.fidelity} | ${e.note || ''} |`);
    }

    return lines.join('\n');
  }
}

module.exports = { FidelityReporter, FIDELITY_ICONS };
