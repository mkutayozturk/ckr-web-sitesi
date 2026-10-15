"""Server validation of the versioned buyer/seller readiness model."""
import json
from pathlib import Path
MODEL = json.loads(Path(__file__).with_name('motivation_model.json').read_text())

def evaluate_readiness(key, answers, allow_incomplete=True):
    config = MODEL['forms'].get(key)
    if not config:
        return None
    questions = config['questions']
    def label(option): return option if isinstance(option, str) else option['label']
    time_index = next((i for i, o in enumerate(questions[0]['options']) if label(o) == answers.get('zaman_zorunlulugu')), -1)
    active = [questions[0], MODEL['deadline'], *questions[1:]] if time_index in (0, 1) else questions
    selections = {q['name']: answers[q['name']] for q in active if any(label(o) == answers.get(q['name']) for o in q['options'])}
    missing = [q['label'] for q in active if q['name'] not in selections]
    base = dict(model_version=MODEL['version'], selections=selections, responses={q['label']: selections[q['name']] for q in active if q['name'] in selections}, completion='incomplete' if missing else 'complete')
    if missing:
        return dict(answers=dict(base, missing=missing, group=None, blockers=[]), score=None, category='Değerlendirilmedi', summary='Motivasyon soruları eksik yanıtlandığı için motivasyon puanı hesaplanmadı.') if allow_incomplete else None
    indices = [next(i for i,o in enumerate(q['options']) if label(o) == selections[q['name']]) for q in questions]
    raw = sum(q['options'][indices[i]]['score'] for i,q in enumerate(questions))
    recommendations = (['Hedef tarihinizi işlem hazırlıklarıyla birlikte planlayın.', 'Satışla gerçekleştirmek istediğiniz hedefi belirleyin.', 'Fiyatınızı güncel piyasa verileri ve değerlemeyle karşılaştırın.', 'Teklifleri değerlendirecek karar planını hazırlayın.', 'Gösterim için düzenli randevu saatleri belirleyin.', 'Kiracı, evrak ve teslim koşullarını satış öncesinde netleştirin.', 'Satış kararınızı ve diğer karar vericilerin onayını kesinleştirin.', 'Piyasa analizi doğrultusunda fiyat beklentinizi yeniden değerlendirin.'] if key == 'satici' else ['Hedef tarihinizi işlem hazırlıklarıyla birlikte planlayın.', 'Satın alımla gerçekleştirmek istediğiniz hedefi belirleyin.', 'Toplam bütçenizi ve ödeme sınırlarınızı belirleyin.', 'İnceleme ve teklif verme sürecinizi planlayın.', 'Yerinde inceleme için randevu saatleri belirleyin.', 'Finansmanınızı ve ödeme kaynağınızı kesinleştirin.', 'Satın alma kararınızı kesinleştirin.', 'Kriterlerinizi bütçe ve piyasa koşullarıyla karşılaştırın.'])
    advice = [dict(question=questions[i]['label'], answer=selections[questions[i]['name']], text=recommendations[i]) for i in range(1,8) if indices[i] >= 2]
    blockers = [recommendations[i] for i in range(2,8) if indices[i] >= 2]
    decision_ready = indices[6] == 0 and indices[1] <= 1
    score = min(raw, MODEL['critical_cap'] if blockers else (100 if decision_ready else 79))
    ready = score >= MODEL['ready_threshold'] and not blockers and indices[6] == 0 and indices[1] <= 1
    deadline_index = next((i for i,o in enumerate(MODEL['deadline']['options']) if o == selections.get('son_tarih')), -1)
    urgent = indices[0] <= 1 and 0 <= deadline_index <= 1 and indices[1] <= 1
    group = ('A+' if urgent else 'A') if ready else ('B' if score >= 40 else 'C')
    action = 'satış' if key == 'satici' else 'satın alma'
    if ready:
        tail = 'Yakın hedef tarihiniz nedeniyle inceleme, finansman ve işlem adımlarını birlikte takvimlendirmek önem taşıyor.' if urgent else 'Acil bir zaman zorunluluğu olmadan da hazırlıklı ilerleyebilirsiniz. Uygun koşulları ve işlem adımlarını birlikte planlayabiliriz.'
        summary = f'Yanıtlarınız {action} kararınızın, piyasa yaklaşımınızın ve işlem hazırlığınızın uyumlu olduğunu gösteriyor. {tail}'
    else:
        tail = ' '.join(blockers[:2]) if blockers else 'İşlem gerekçenizi, kararınızı ve önceliklerinizi birlikte değerlendirebiliriz.'
        summary = f'Yanıtlarınıza göre {action} sürecine geçmeden önce bazı hazırlıkları tamamlamanız yararlı olacaktır. {tail} Bu değerlendirme, yanıtlarınıza dayalı bir hazırlık göstergesidir.'
    return dict(answers=dict(base, raw_score=raw, final_score=score, applied_cap=MODEL['critical_cap'] if blockers else None, group=group, ready=ready, urgent=urgent, blockers=blockers, advice=advice), score=score, category='HAZIRSINIZ' if ready else 'HAZIR DEĞİLSİNİZ', summary=summary)
