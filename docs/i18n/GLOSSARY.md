# BIZSIM translation glossary

These are the agreed renderings of BIZSIM's core terms. Translators and reviewers should use them
consistently across the interface, notifications, reports and season overlays. The table is
generated from the live resource files, so it shows what the app actually displays.

Status: every non-English rendering below is **machine-assisted and not yet reviewed** by a
native speaker. A reviewer who changes a term should change it everywhere it appears and update
this table (`node` script in the "Regenerating" section).

## Rules that apply in every language

- **Season, episode, decision.** A season is a whole case (four episodes). An episode is one
  turning point with two to four linked decisions. Keep the three words distinct; never use the
  same word for season and episode.
- **Process quality vs matched history.** Process quality judges a decision on what was known at
  the time. Matched history only says whether the player chose what actually happened. The two
  terms must never be merged or made to sound like a grade for "being right".
- **Counterfactual.** A reasoned estimate of what might have happened under another choice. It is
  never presented as a record.
- **Evidence status labels** (Checked, Not verified, Source unreachable, No source, Unchecked)
  describe an automated text match. Translations must not claim more certainty than the English
  ("checked against source", not "proven").
- **AI-written.** Always disclosed. Do not soften it to "assisted" or "generated with help".
- **Do not translate:** BIZSIM, product and company names, model names, Wikidata, Wikipedia,
  SEC EDGAR, XBRL, 10-K, 20-F, file extensions (.bizsim), placeholders such as `{{count}}`, and
  markup tags such as `<strong>`.
- **No em dashes** in interface text in any language. Use a comma, colon or full stop.
- **Digits.** Bengali text uses Bengali digits in static text; numbers inserted at run time are
  formatted by `Intl` for the locale. Arabic uses Latin digits, which is what `Intl` produces for `ar`.
- **Language names inside sentences** are written as "language: {{language}}" in languages with
  grammatical case (de, ru, tr, ar, ur, hi, bn, zh, ja, ko) so the inserted name never needs inflecting.

## Core terms

| English | বাংলা (bn) | Español (es) | Português (Brasil) (pt-BR) | Français (fr) | العربية (ar) | हिन्दी (hi) | 简体中文 (zh-Hans) | 日本語 (ja) | Deutsch (de) | Русский (ru) | Bahasa Indonesia (id) | Türkçe (tr) | 한국어 (ko) | اردو (ur) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Season (`collections.ref.season`) | সিজন | Temporada | Temporada | Saison | موسم | सीज़न | 季 | シーズン | Staffel | Сезон | Musim | Sezon | 시즌 | سیزن |
| Episode (`collections.ref.episode`) | পর্ব | Episodio | Episódio | Épisode | حلقة | एपिसोड | 集 | エピソード | Episode | Эпизод | Episode | Bölüm | 에피소드 | قسط |
| Decision (`collections.ref.decision`) | সিদ্ধান্ত | Decisión | Decisão | Décision | قرار | निर्णय | 决策 | 意思決定 | Entscheidung | Решение | Keputusan | Karar | 의사결정 | فیصلہ |
| Case (`navigation.cases`) | কেস | Casos | Casos | Cas | الحالات | केस | 案例 | ケース | Fälle | Кейсы | Kasus | Vakalar | 케이스 | کیس |
| Principle (`collections.ref.principle`) | নীতি | Principio | Princípio | Principe | مبدأ | सिद्धांत | 原则 | 原則 | Prinzip | Принцип | Prinsip | İlke | 원칙 | اصول |
| Situation (`method.steps.situation`) | পরিস্থিতি | Situación | Situação | Situation | الموقف | स्थिति | 情境 | 状況 | Situation | Ситуация | Situasi | Durum | 상황 | صورتِ حال |
| Concept (`method.steps.concept`) | ধারণা | Concepto | Conceito | Concept | المفهوم | अवधारणा | 概念 | 概念 | Konzept | Концепция | Konsep | Kavram | 개념 | تصور |
| Evidence (`method.steps.evidence`) | প্রমাণ | Evidencia | Evidências | Éléments probants | الأدلة | साक्ष्य | 证据 | 証拠 | Belege | Факты | Bukti | Kanıt | 증거 | شواہد |
| Outcome (`method.steps.outcome`) | ফলাফল | Resultado | Desfecho | Dénouement | النتيجة | परिणाम | 结果 | 結果 | Ergebnis | Итог | Hasil | Sonuç | 결과 | نتیجہ |
| Insight (`method.steps.insight`) | শিক্ষা | Lección | Lição | Enseignement | الخلاصة | सीख | 启示 | 洞察 | Erkenntnis | Вывод | Wawasan | Ders | 통찰 | سبق |
| Process quality (`case.reveal.processQuality`) | প্রক্রিয়ার মান | Calidad del proceso | Qualidade do processo | Qualité du processus | جودة العملية | प्रक्रिया की गुणवत्ता | 过程质量 | プロセスの質 | Prozessqualität | Качество процесса | Kualitas proses | Süreç kalitesi | 과정의 질 | عمل کا معیار |
| Matched history (`case.compare.matched`) | ইতিহাসের সঙ্গে মিল | Coincidencia con la historia | Coincidência com a história | Concordance avec l’histoire | التطابق مع التاريخ | इतिहास से मेल | 与历史一致 | 歴史と一致 | Übereinstimmung mit der Geschichte | Совпадение с историей | Kecocokan dengan sejarah | Tarihle örtüşme | 역사와 일치 | تاریخ سے مطابقت |
| Counterfactual (`contentClass.counterfactual.short`) | বিকল্প-বাস্তবতা | Contrafactual | Contrafactual | Contrefactuel | افتراضي | प्रतितथ्यात्मक | 反事实 | 反実仮想 | Kontrafaktisch | Контрфактический | Kontrafaktual | Karşı-olgusal | 반사실 | فرضی متبادل |
| Documented history (`contentClass.documented.label`) | নথিভুক্ত ইতিহাস | Historia documentada | História documentada | Histoire documentée | تاريخ موثَّق | प्रलेखित इतिहास | 有据可查的历史 | 記録された歴史 | Dokumentierte Geschichte | Документированная история | Sejarah terdokumentasi | Belgelenmiş tarih | 기록된 역사 | دستاویزی تاریخ |
| AI-written (`contentClass.aiWritten`) | এআই-লিখিত | Escrito por IA | Escrito por IA | Écrit par l’IA | كتبه الذكاء الاصطناعي | एआई-लिखित | AI 撰写 | AI 作成 | KI-geschrieben | Написано ИИ | Ditulis AI | YZ tarafından yazıldı | AI 작성 | مصنوعی ذہانت کا لکھا ہوا |
| Hypothetical scenarios (`case.outcome.scenarios`) | কাল্পনিক পরিস্থিতি | Escenarios hipotéticos | Cenários hipotéticos | Scénarios hypothétiques | سيناريوهات افتراضية | काल्पनिक परिदृश्य | 假设情景 | 仮想シナリオ | Hypothetische Szenarien | Гипотетические сценарии | Skenario hipotetis | Varsayımsal senaryolar | 가상 시나리오 | فرضی منظرنامے |
| Source (`explore.source`) | উৎস | Fuente | Fonte | Source | المصدر | स्रोत | 来源 | 出典 | Quelle | Источник | Sumber | Kaynak | 출처 | ماخذ |
| Live research (`search.groups.research`) | লাইভ গবেষণা | Investigación en vivo | Pesquisa ao vivo | Recherche en direct | بحث مباشر | लाइव रिसर्च | 实时研究 | ライブリサーチ | Live-Recherche | Исследование в реальном времени | Riset langsung | Canlı araştırma | 실시간 리서치 | براہِ راست تحقیق |
| Learning profile (`navigation.learning`) | শেখার প্রোফাইল | Perfil de aprendizaje | Perfil de aprendizado | Profil d’apprentissage | ملف التعلّم | सीखने की प्रोफ़ाइल | 学习档案 | 学習プロフィール | Lernprofil | Профиль обучения | Profil Belajar | Öğrenme profili | 학습 프로필 | سیکھنے کا پروفائل |
| Collections (`navigation.collections`) | সংগ্রহ | Colecciones | Coleções | Collections | المجموعات | संग्रह | 收藏集 | コレクション | Sammlungen | Коллекции | Koleksi | Koleksiyonlar | 컬렉션 | مجموعے |
| Transfer code (`transfer.send.copy`) | স্থানান্তর কোড কপি করুন | Copiar código de transferencia | Copiar código de transferência | Copier le code de transfert | نسخ رمز النقل | ट्रांसफ़र कोड कॉपी करें | 复制传输代码 | 転送コードをコピー | Übertragungscode kopieren | Скопировать код передачи | Salin kode transfer | Aktarım kodunu kopyala | 전송 코드 복사 | منتقلی کوڈ کاپی کریں |
| Pairing code (`transfer.computer.scan`) | পেয়ারিং কোড স্ক্যান করুন | Escanear código de emparejamiento | Escanear código de pareamento | Scanner un code d’association | مسح رمز الاقتران | पेयरिंग कोड स्कैन करें | 扫描配对代码 | ペアリングコードをスキャン | Kopplungscode scannen | Сканировать код сопряжения | Pindai kode pemasangan | Eşleştirme kodunu tara | 페어링 코드 스캔 | جوڑنے کا کوڈ اسکین کریں |
| Backup (`settings.restore.backup`) | ব্যাকআপ | Copia de seguridad | Backup | Sauvegarde | نسخة احتياطية | बैकअप | 备份 | バックアップ | Sicherung | Резервная копия | Cadangan | Yedek | 백업 | بیک اپ |

English (UK) uses the same terms as English (US) with British spelling (organisation, licence,
recognises, labelled, decentralised, standardisation, outmanoeuvring).

## Regenerating the table

The table above was produced from `client/src/i18n/resources/*.json`. When a reviewer changes a
term, change it in the resource file first, then regenerate the table with a short Node script
that reads the same keys (listed in backticks in the first column).
