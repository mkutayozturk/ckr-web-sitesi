import React from 'react';
import useReveal from '../../hooks/useReveal';

export default function AboutMe() {
  useReveal();
  return (
    <section id="ben-kimim" className="ckr-section" style={{ background: 'transparent' }}>
      <div className="ckr-container">
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 0.82fr) minmax(320px, 1.18fr)', gap: 46, alignItems: 'start' }} className="ckr-about-grid">
          <div className="ckr-fade-up" style={{ position: 'relative' }}>
            <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(246,242,232,0.18)', maxWidth: 430, boxShadow: '0 22px 56px rgba(0,0,0,0.24)' }}>
              <img src="/kutay-about.png" alt="M. Kutay Öztürk" style={{ width: '100%', height: 620, objectFit: 'cover', objectPosition: '58% center', display: 'block' }} />
            </div>
          </div>

          <div className="ckr-fade-up ckr-about-copy">
            <h2 style={{ fontSize: 'clamp(28px, 3vw, 38px)', fontWeight: 600, color: '#f3efe6', marginTop: 0, marginBottom: 8 }}>
              Ben Kimim?
            </h2>
            <h3 style={{ fontSize: 'clamp(20px, 2vw, 26px)', fontWeight: 600, color: 'var(--ckr-gold-soft)', marginTop: 0, marginBottom: 22 }}>
              M. Kutay Öztürk
            </h3>

            <p>23 Ocak 1985'te Çanakkale'nin Çan ilçesinde doğdum. 2003 yılında Çanakkale H.A.T. Güzel Sanatlar Lisesi'nden, 2008 yılında ise Marmara Üniversitesi Güzel Sanatlar Fakültesi Seramik-Cam Bölümü'nden mezun oldum.</p>
            <p>Sanat, hayatımın önemli bir parçası oldu. Bana yalnızca estetik bir bakış açısı değil; ayrıntılara dikkat etmeyi, bütünü görmeyi ve bir şeyin değerini anlamak için görünenin ötesine bakmayı da öğretti.</p>
            <p>İnşaat ve emlak sektörleri ise ailemden dolayı çocukluğumdan beri aşina olduğum alanlardı. Buna rağmen meslek hayatım farklı bir yönde ilerledi. Uzun yıllar İstanbul'da kendi dövme stüdyomu ve kafemi işlettim. Farklı insanlarla çalıştığım, insan ilişkilerini ve işletmeciliği deneyimlediğim bu yılların ardından pandemiyle birlikte memleketim Çanakkale'ye dönme kararı aldım.</p>
            <p>Bugün gayrimenkul danışmanlığında sanat geçmişimin kazandırdığı bakış açısını, işletmecilik deneyimimi ve ailemden gelen sektör aşinalığını bir araya getiriyorum.</p>
            <p><strong>Benim için gayrimenkul danışmanlığı yalnızca bir mülkü pazarlamak veya el değiştirmesine aracılık etmek değil; insanların hayatlarını ve birikimlerini etkileyen önemli kararlarda onlara doğru rehberlik edebilmektir.</strong></p>
            <p>Çanakkale'de konut alım satım kararlarını yalnızca ilan fiyatları üzerinden değil; alıcının davranışı, satıcının motivasyonu, bölgenin gerçekleri ve doğru değerleme yaklaşımıyla ele alıyorum.</p>
            <p><strong>Çanakkale Konut Rehberi de tam olarak bu anlayıştan doğdu.</strong></p>
            <p>Fiyatların, beklentilerin ve piyasa koşullarının sürekli değiştiği bir sektörde, alıcıların ve satıcıların kararlarını anlaşılır, şeffaf ve gerçekçi bilgilerle verebilmelerine yardımcı olmayı amaçlıyorum.</p>
            <p>Çünkü doğru bir gayrimenkul kararı için yalnızca <em>“Bu mülk kaç para?”</em> sorusunun cevabı yeterli değildir.</p>
            <p>Alıcının <strong>neye para verdiğini</strong>, satıcının ise mülkünün <strong>alıcı gözündeki gerçek konumunu</strong> bilmesi gerekir.</p>
            <p>Çanakkale Konut Rehberi'nin varlık nedeni de tam olarak bu:</p>
            <p><strong>Alıcı ve satıcıyı piyasa gerçekleriyle buluşturmak.</strong></p>
          </div>
        </div>
      </div>
    </section>
  );
}
