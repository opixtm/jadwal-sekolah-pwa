document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('./kuliah_parsed.json');
        if(!response.ok) throw new Error("Gagal mengambil data jadwal");
        
        const data = await response.json();
        renderSyllabus(data);
        
    } catch (error) {
        document.getElementById('syllabus-container').innerHTML = `
            <div class="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 text-center">
                <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                <p class="font-bold">Gagal memuat jadwal</p>
                <p class="text-sm mt-1">${error.message}</p>
                <p class="text-xs mt-3 opacity-70">Pastikan file kuliah_parsed.json tersedia.</p>
            </div>
        `;
    }
    
    // Toggle all button logic
    document.getElementById('expand-all-btn')?.addEventListener('click', (e) => {
        const isBuka = e.target.innerText.includes('Expand');
        document.querySelectorAll('.accordion-item').forEach(el => {
            if(isBuka) el.classList.add('accordion-open');
            else el.classList.remove('accordion-open');
        });
        e.target.innerText = isBuka ? 'Collapse All' : 'Expand All';
    });
});

function renderSyllabus(data) {
    const container = document.getElementById('syllabus-container');
    document.getElementById('stats-badge').innerHTML = `<i class="fas fa-check-circle mr-1"></i> ${data.length} Sesi Terbaca`;
    container.innerHTML = '';
    
    // Grouping data by Minggu
    const grouped = data.reduce((acc, item) => {
        if (!acc[item.minggu]) {
            acc[item.minggu] = { dates: item.rentang_tanggal, items: [] };
        }
        acc[item.minggu].items.push(item);
        return acc;
    }, {});
    
    let isFirst = true;

    for (const [minggu, group] of Object.entries(grouped)) {
        // Build items HTML
        let itemsHtml = '';
        group.items.forEach(session => {
            // Determine styles based on session code/type (e.g., KP, SL, Pleno)
            let badgeBg = 'bg-gray-100 text-gray-600';
            let icon = 'fas fa-book';
            
            if (session.kode.includes('KP')) {
                badgeBg = 'bg-blue-100 text-blue-700'; // Kuliah Pakar
                icon = 'fas fa-chalkboard-teacher';
            } else if (session.kode.includes('SL')) {
                badgeBg = 'bg-emerald-100 text-emerald-700'; // Skills Lab
                icon = 'fas fa-microscope';
            } else if (session.kode.includes('Pleno') || session.kode.includes('A & B')) {
                badgeBg = 'bg-purple-100 text-purple-700'; // Pleno
                icon = 'fas fa-users';
            }

            // Cleanup dosen representation if it contains pipe
            const dosenClean = session.dosen.replace(/ \| /g, '<br><span class="text-[10px] opacity-50 mt-1 inline-block">Dan Asisten/Dosen Lainnya</span>');

            itemsHtml += `
                <div class="border-l-2 border-indigo-200 pl-4 py-2 relative">
                    <div class="absolute -left-[5px] top-4 w-2 h-2 rounded-full bg-indigo-400"></div>
                    <div class="flex flex-wrap gap-2 mb-1 items-center">
                        <span class="text-[10px] font-black tracking-wider px-2 py-0.5 rounded ${badgeBg}"><i class="${icon} mr-1"></i>${session.kode}</span>
                        ${session.no ? `<span class="text-[10px] font-bold text-gray-400">Sesi #${session.no}</span>` : ''}
                    </div>
                    <h4 class="font-bold text-gray-800 text-sm leading-tight mb-1">${session.materi}</h4>
                    <p class="text-xs text-gray-500 flex gap-2 items-start mt-2">
                        <i class="fas fa-user-circle mt-0.5 opacity-50"></i>
                        <span class="leading-snug">${dosenClean}</span>
                    </p>
                </div>
            `;
        });

        // Build Accordion wrapper
        const accordionHtml = `
            <div class="accordion-item bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm ${isFirst ? 'accordion-open' : ''}">
                <button class="accordion-header w-full flex justify-between items-center p-5 bg-gradient-to-r from-white to-gray-50 hover:bg-gray-50 transition-colors" onclick="this.parentElement.classList.toggle('accordion-open')">
                    <div class="text-left flex gap-4 items-center">
                        <div class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black">
                            ${minggu.split(' ')[1] || 'X'}
                        </div>
                        <div>
                            <h3 class="font-bold text-lg text-gray-900">${minggu}</h3>
                            <p class="text-xs font-medium text-gray-400 mt-0.5"><i class="far fa-clock mr-1"></i>${group.dates}</p>
                        </div>
                    </div>
                    <div class="text-gray-400 icon-rotate bg-white shadow-sm w-8 h-8 rounded-full flex items-center justify-center border border-gray-100">
                        <i class="fas fa-chevron-down text-sm"></i>
                    </div>
                </button>
                <div class="accordion-content bg-white">
                    <div class="p-5 pt-2 space-y-4 border-t border-gray-50 ml-2">
                        ${itemsHtml}
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML += accordionHtml;
        isFirst = false;
    }
}
