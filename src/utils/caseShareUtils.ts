import { Case, HearingSession } from '../types';

/**
 * دالة مساعدة لنسخ النصوص إلى الحافظة بتوافقية تامة مع مختلف الأجهزة (هواتف وكمبيوتر ومتصفحات وبيئات iFrame)
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // تجربة البديل في حال تعثر الـ API المباشر
    }
  }
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Failed to copy to clipboard', err);
    return false;
  }
}

/**
 * دالة بناء نص منسق واحترافي لبيانات القضية لمشاركته أو نسخه
 * يتضمن: رقم القضية، المحكمة، الأطراف وصفاتهم، موضوع القضية، وآخر جلستين
 */
export function buildCaseShareText(localCase: Case, caseSessions: HearingSession[] = []): string {
  const sections: string[] = [];

  // 1. رقم القضية
  const headerLines: string[] = [];
  let caseNum = '';
  if (localCase.caseNumberFirstInstance) {
    caseNum = localCase.caseYearFirstInstance
      ? `${localCase.caseNumberFirstInstance} لسنة ${localCase.caseYearFirstInstance}`
      : localCase.caseNumberFirstInstance;
  } else if (localCase.caseNumberSecondInstance) {
    caseNum = localCase.caseYearSecondInstance
      ? `${localCase.caseNumberSecondInstance} لسنة ${localCase.caseYearSecondInstance}`
      : localCase.caseNumberSecondInstance;
  } else if (localCase.cassationNumber) {
    caseNum = localCase.cassationYear
      ? `${localCase.cassationNumber} لسنة ${localCase.cassationYear}`
      : localCase.cassationNumber;
  } else if (localCase.investigationNumber) {
    caseNum = localCase.investigationYear
      ? `${localCase.investigationNumber} لسنة ${localCase.investigationYear}`
      : localCase.investigationNumber;
  }

  if (caseNum && caseNum.trim()) {
    headerLines.push(`رقم القضية: ${caseNum.trim()}`);
  }

  // 2. المحكمة
  const courtName = (localCase.court || localCase.courtFirstInstance || '').trim();
  if (courtName) {
    headerLines.push(`المحكمة: ${courtName}`);
  }

  // 3. الأطراف وصفاتهم
  const rawParties: { name: string; role?: string }[] = [];
  if (localCase.clientsList && localCase.clientsList.length > 0) {
    for (const cl of localCase.clientsList) {
      if (cl && cl.name && cl.name.trim()) {
        rawParties.push({
          name: cl.name.trim(),
          role: cl.role && cl.role.trim() ? cl.role.trim() : undefined
        });
      }
    }
  } else if (localCase.clientName && localCase.clientName.trim()) {
    rawParties.push({
      name: localCase.clientName.trim(),
      role: (localCase as any).clientRole && (localCase as any).clientRole.trim() 
        ? (localCase as any).clientRole.trim() 
        : undefined
    });
  }

  if (localCase.opponentsList && localCase.opponentsList.length > 0) {
    for (const opp of localCase.opponentsList) {
      if (opp && opp.name && opp.name.trim()) {
        rawParties.push({
          name: opp.name.trim(),
          role: opp.role && opp.role.trim() ? opp.role.trim() : undefined
        });
      }
    }
  } else if (localCase.opponent && localCase.opponent.name && localCase.opponent.name.trim()) {
    rawParties.push({
      name: localCase.opponent.name.trim(),
      role: localCase.opponent.role && localCase.opponent.role.trim() 
        ? localCase.opponent.role.trim() 
        : undefined
    });
  }

  const uniqueParties: { name: string; role?: string }[] = [];
  const seen = new Set<string>();
  for (const p of rawParties) {
    const key = `${p.name}:::${p.role || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueParties.push(p);
    }
  }

  const partyLines: string[] = [];
  if (uniqueParties.length > 0) {
    partyLines.push('الأطراف:');
    for (const p of uniqueParties) {
      if (p.role) {
        partyLines.push(`- ${p.name} — الصفة: ${p.role}`);
      } else {
        partyLines.push(`- ${p.name}`);
      }
    }
  }

  // تجميع الكتلة العلوية: رقم القضية، المحكمة، الأطراف
  const topBlockLines = [...headerLines];
  if (partyLines.length > 0) {
    topBlockLines.push(...partyLines);
  }
  if (topBlockLines.length > 0) {
    sections.push(topBlockLines.join('\n'));
  }

  // 4. موضوع القضية
  const subjectStr = (localCase.subject || (localCase as any).caseSubject || '').trim();
  if (subjectStr) {
    sections.push(`موضوع القضية: ${subjectStr}`);
  }

  // 5. آخر جلستين
  interface SessionItemForShare {
    date?: string;
    decision?: string;
    whatHappened?: string;
    decisionOrAction?: string;
    sessionType?: string;
  }

  const validSessions: SessionItemForShare[] = (caseSessions || [])
    .map(s => {
      let sType = '';
      if ((s as any).sessionType && typeof (s as any).sessionType === 'string') {
        sType = (s as any).sessionType;
      } else if (s.isDetentionRenewal) {
        sType = 'تجديد حبس احتياطي';
      } else if (s.isExpertSession) {
        sType = 'جلسة خبراء';
      }
      return {
        date: s.date,
        decision: s.decision,
        whatHappened: s.whatHappened,
        decisionOrAction: (s as any).decisionOrAction,
        sessionType: sType || undefined
      };
    })
    .filter(s => s && (s.date || s.decision || s.whatHappened || s.decisionOrAction));

  if (localCase.detentionRenewals && localCase.detentionRenewals.length > 0) {
    for (const ren of localCase.detentionRenewals) {
      const renDate = ren.renewalDate || ren.date;
      if (renDate && !validSessions.some(s => s.date === renDate)) {
        validSessions.push({
          date: renDate,
          decision: ren.decision,
          sessionType: 'تجديد حبس احتياطي'
        });
      }
    }
  }

  validSessions.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  if (validSessions.length > 0) {
    const lastTwo = validSessions.slice(-2);
    const arabicNums = ['١', '٢'];
    const sessionBlocks: string[] = [];

    lastTwo.forEach((sess, idx) => {
      const num = arabicNums[idx] || (idx + 1);
      const sLines: string[] = [];
      if (sess.date && sess.date.trim()) {
        sLines.push(`${num}- تاريخ الجلسة: ${sess.date.trim()}`);
      }

      if (sess.sessionType && sess.sessionType.trim()) {
        sLines.push(`نوع الجلسة: ${sess.sessionType.trim()}`);
      }

      const decision = sess.decision?.trim() || sess.decisionOrAction?.trim() || sess.whatHappened?.trim();
      if (decision) {
        sLines.push(`القرار: ${decision}`);
      }

      if (sLines.length > 0) {
        sessionBlocks.push(sLines.join('\n'));
      }
    });

    if (sessionBlocks.length > 0) {
      sections.push(`آخر جلستين:\n${sessionBlocks.join('\n\n')}`);
    }
  }

  return sections.join('\n\n');
}
