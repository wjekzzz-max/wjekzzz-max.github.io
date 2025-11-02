import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Supabase 설정: 아래 두 값을 본인 프로젝트 값으로 변경하세요.
const SUPABASE_URL = window.SUPABASE_URL || 'https://ukzyflvgnagekrlxfsdp.supabase.co';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrenlmbHZnbmFnZWtybHhmc2RwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4ODUxOTEsImV4cCI6MjA3NzQ2MTE5MX0.OOZhNNJN4zeKC10vHcSC9JWtbxzzz514jbOOcRCqDBA';

// 전역 상태
const state = {
    supabase: null,
    session: null,
    pendingReportTarget: null,
    isAdmin: false,  // 관리자 여부
    activeMessageDialog: null,  // 현재 열려있는 메시지 다이얼로그 정보 {requestId, receiverId}
    lastCheckedMessageTime: null,  // 마지막으로 확인한 메시지 시간
    messageCheckInterval: null,  // 메시지 확인 인터벌
};

// 관리자 이메일 리스트 (여기에 관리자 이메일을 추가하세요)
const ADMIN_EMAILS = [
    'wjekzzz@gmail.com',
    // 여기에 더 많은 관리자 이메일 추가 가능
];

// 관리자 여부 확인 함수
async function isAdmin(email) {
    if (!email) return false;
    
    // 1. 하드코딩된 관리자 이메일 리스트 확인
    if (ADMIN_EMAILS.includes(email.toLowerCase())) {
        return true;
    }
    
    // 2. Supabase admins 테이블에서 확인 (선택사항)
    if (state.supabase) {
        try {
            const { data, error } = await state.supabase
                .from('admins')
                .select('email')
                .eq('email', email.toLowerCase())
                .maybeSingle();
            
            if (!error && data) {
                return true;
            }
        } catch (_) {
            // admins 테이블이 없으면 무시
        }
    }
    
    return false;
}

// 초기화
async function initApp() {
    // 연도 표기
    const y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();

    // Supabase 클라이언트
    state.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data } = await state.supabase.auth.getSession();
    state.session = data.session;
    
    // 페이지 새로고침 시 관리자 여부는 localStorage에서 복원
    // (처음 로그인할 때만 저장, 새로고침 후에는 일반 사용자로 시작)
    if (state.session?.user) {
        const savedAdminStatus = localStorage.getItem('isAdmin') === 'true';
        const emailMatchesAdmin = await isAdmin(state.session.user.email);
        // 관리자 이메일이면서 저장된 상태가 관리자일 때만 관리자로 인식
        state.isAdmin = savedAdminStatus && emailMatchesAdmin;
    } else {
        state.isAdmin = false;
    }

    setupAuthUI();
    setupRouting();
    
    // 로그인되어 있으면 메시지 알림 시작
    if (state.session?.user) {
        startMessageNotifications();
    }
}

function setupAuthUI() {
    const loginBtn = document.getElementById('loginBtn');
    const adminLoginBtn = document.getElementById('adminLoginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const authDialog = document.getElementById('authDialog');
    const authClose = document.getElementById('authClose');
    const toggleAuthMode = document.getElementById('toggleAuthMode');
    const authForm = document.getElementById('authForm');
    const authTitle = document.getElementById('authTitle');
    const authSubmit = document.getElementById('authSubmit');
    const authPassword2Input = document.getElementById('authPassword2');

    // 관리자 로그인 관련
    const adminAuthDialog = document.getElementById('adminAuthDialog');
    const adminAuthForm = document.getElementById('adminAuthForm');
    const adminAuthTitle = document.getElementById('adminAuthTitle');
    const adminAuthEmail = document.getElementById('adminAuthEmail');
    const adminAuthPassword = document.getElementById('adminAuthPassword');
    const adminAuthSubmit = document.getElementById('adminAuthSubmit');
    const adminAuthClose = document.getElementById('adminAuthClose');

    let isSignup = false;

    const adminLink = document.getElementById('adminLink');
    
    async function updateButtons() {
        if (state.session) {
            loginBtn.style.display = 'none';
            adminLoginBtn.style.display = 'none';
            logoutBtn.style.display = '';
            
            // 관리자 여부는 로그인 방법에 따라 결정되므로 state.isAdmin 사용
            updateAdminBadge(state.isAdmin);
            
            // 관리자 링크 표시/숨김
            if (adminLink) {
                adminLink.style.display = state.isAdmin ? '' : 'none';
            }
        } else {
            loginBtn.style.display = '';
            adminLoginBtn.style.display = '';
            logoutBtn.style.display = 'none';
            state.isAdmin = false;
            updateAdminBadge(false);
            
            if (adminLink) {
                adminLink.style.display = 'none';
            }
        }
    }

    function updateAdminBadge(isAdmin) {
        // 기존 관리자 배지 제거
        const existingBadge = document.getElementById('adminBadge');
        if (existingBadge) {
            existingBadge.remove();
        }

        if (isAdmin && state.session) {
            // 관리자 배지 생성
            const adminBadge = document.createElement('span');
            adminBadge.id = 'adminBadge';
            adminBadge.className = 'admin-badge';
            adminBadge.textContent = '👑 관리자';
            adminBadge.title = '관리자 계정';
            
            // 로그아웃 버튼 앞에 배지 추가
            logoutBtn.parentNode.insertBefore(adminBadge, logoutBtn);
        }
    }
    
    // 초기 버튼 상태 업데이트 (비동기 처리)
    updateButtons().catch(() => {});

    loginBtn.addEventListener('click', () => {
        isSignup = false;
        authTitle.textContent = '로그인';
        authSubmit.textContent = '로그인';
        toggleAuthMode.textContent = '회원가입';
        authDialog.showModal();
    });

    adminLoginBtn.addEventListener('click', () => {
        adminAuthDialog.showModal();
    });

    adminAuthClose.addEventListener('click', () => {
        adminAuthDialog.close();
    });

    // 관리자 다이얼로그의 비밀번호 표시/숨기기 토글
    const adminPasswordToggle = adminAuthDialog.querySelector('.password-toggle');
    if (adminPasswordToggle) {
        adminPasswordToggle.addEventListener('click', (e) => {
            e.preventDefault();
            const input = document.getElementById('adminAuthPassword');
            const eyeIcon = adminPasswordToggle.querySelector('.eye-icon');
            const eyeOffIcon = adminPasswordToggle.querySelector('.eye-off-icon');
            if (input.type === 'password') {
                input.type = 'text';
                if (eyeIcon) eyeIcon.style.display = 'none';
                if (eyeOffIcon) eyeOffIcon.style.display = 'block';
            } else {
                input.type = 'password';
                if (eyeIcon) eyeIcon.style.display = 'block';
                if (eyeOffIcon) eyeOffIcon.style.display = 'none';
            }
        });
    }
    logoutBtn.addEventListener('click', async () => {
        await state.supabase.auth.signOut();
        state.session = null;
        state.isAdmin = false;
        localStorage.removeItem('isAdmin');  // 로그아웃 시 관리자 상태 제거
        await updateButtons();
        navigateTo('#/');
    });
    authClose.addEventListener('click', () => authDialog.close());
    toggleAuthMode.addEventListener('click', () => {
        isSignup = !isSignup;
        authTitle.textContent = isSignup ? '회원가입' : '로그인';
        authSubmit.textContent = isSignup ? '회원가입' : '로그인';
        toggleAuthMode.textContent = isSignup ? '로그인으로' : '회원가입';
    });
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('authEmail').value.trim();
        const password = document.getElementById('authPassword').value;
        const password2 = authPassword2Input.value;
        if (!email || !password) return;
        // 회원가입일 때는 반드시 비밀번호 확인 일치 필요
        if (isSignup) {
            if (!password2) { alert('비밀번호 확인을 입력하세요.'); return; }
            if (password !== password2) { alert('비밀번호가 일치하지 않습니다.'); return; }
        } else {
            // 로그인일 때 비밀번호 확인이 입력되어 있으면 일치 검증, 비어있으면 무시
            if (password2 && password !== password2) { alert('비밀번호가 일치하지 않습니다.'); return; }
        }
        try {
            if (isSignup) {
                // 일반 회원가입은 항상 일반 사용자로 처리
                const { data: signUpData, error: signUpError } = await state.supabase.auth.signUp({ email, password });
                if (signUpError) throw signUpError;
                // 일부 설정에서는 즉시 세션이 생기지 않고 이메일 확인이 필요함
                if (signUpData.session) {
                    state.session = signUpData.session;
                    state.isAdmin = false;  // 일반 회원가입 창에서는 관리자로 인식 안 함
                    localStorage.setItem('isAdmin', 'false');  // 일반 사용자 상태 저장
                    try { await ensureProfile(); } catch(_) {}
                    authDialog.close();
                    await updateButtons();
                    navigateTo('#/');
                } else {
                    // 이메일 확인이 필요한 경우 자동 로그인 시도
                    const { data: signInData, error: signInError } = await state.supabase.auth.signInWithPassword({ email, password });
                    if (signInError) {
                        alert(translateError(signInError) || '회원가입 완료. 이메일 확인 후 다시 로그인해주세요.');
                        isSignup = false;
                        authTitle.textContent = '로그인';
                        authSubmit.textContent = '로그인';
                        toggleAuthMode.textContent = '회원가입';
                    } else {
                        state.session = signInData.session;
                        state.isAdmin = false;  // 일반 회원가입 창에서는 관리자로 인식 안 함
                        localStorage.setItem('isAdmin', 'false');  // 일반 사용자 상태 저장
                        try { await ensureProfile(); } catch(_) {}
                        authDialog.close();
                        await updateButtons();
                        navigateTo('#/');
                    }
                }
            } else {
                // 일반 로그인 (관리자 이메일이어도 일반 사용자로 처리)
                const { data, error } = await state.supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                
                // 일반 로그인 창을 통한 로그인은 항상 일반 사용자로 처리
                state.session = data.session;
                state.isAdmin = false;  // 일반 로그인 창에서는 관리자로 인식 안 함
                localStorage.setItem('isAdmin', 'false');  // 일반 사용자 상태 저장
                try { await ensureProfile(); } catch(_) {}
                authDialog.close();
                await updateButtons();
                navigateTo('#/');
            }
        } catch (err) {
            alert(translateError(err) || '오류가 발생했습니다.');
        }
    });

    state.supabase.auth.onAuthStateChange(async (_event, session) => {
        state.session = session;
        await updateButtons();
        if (session?.user) {
            try { await ensureProfile(); } catch (_) {}
            // 메시지 알림 시작
            startMessageNotifications();
        } else {
            // 로그아웃 시 알림 중지
            stopMessageNotifications();
        }
    });

    // 비밀번호 표시/숨기기 토글
    document.querySelectorAll('.password-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            const eyeIcon = btn.querySelector('.eye-icon');
            const eyeOffIcon = btn.querySelector('.eye-off-icon');
            if (input.type === 'password') {
                input.type = 'text';
                if (eyeIcon) eyeIcon.style.display = 'none';
                if (eyeOffIcon) eyeOffIcon.style.display = 'block';
            } else {
                input.type = 'password';
                if (eyeIcon) eyeIcon.style.display = 'block';
                if (eyeOffIcon) eyeOffIcon.style.display = 'none';
            }
        });
    });

    // 관리자 로그인 폼 제출
    adminAuthForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = adminAuthEmail.value.trim();
        const password = adminAuthPassword.value;
        
        if (!email || !password) {
            alert('이메일과 비밀번호를 입력해주세요.');
            return;
        }

        // 관리자 로그인 창에서는 관리자 체크
        const adminCheck = await isAdmin(email);
        if (!adminCheck) {
            alert('관리자만 로그인할 수 있습니다.\n\n관리자 이메일로만 접근 가능합니다.');
            return;
        }

        adminAuthSubmit.disabled = true;
        adminAuthSubmit.textContent = '로그인 중...';

        try {
            const { data, error } = await state.supabase.auth.signInWithPassword({ email, password });
            
            adminAuthSubmit.disabled = false;
            adminAuthSubmit.textContent = '로그인';

            if (error) {
                alert(translateError(error) || '로그인에 실패했습니다.');
                return;
            }

            // 로그인 성공 후 다시 한 번 관리자 체크 (보안 강화)
            const finalAdminCheck = await isAdmin(data.session.user.email);
            if (!finalAdminCheck) {
                await state.supabase.auth.signOut();
                alert('관리자 권한이 없습니다.');
                return;
            }

            // 관리자 로그인 창을 통한 로그인은 관리자로 인식
            state.session = data.session;
            state.isAdmin = true;  // 관리자 로그인 창을 통해 로그인했으므로 관리자로 설정
            localStorage.setItem('isAdmin', 'true');  // 관리자 상태 저장
            try { await ensureProfile(); } catch(_) {}
            adminAuthDialog.close();
            await updateButtons();
            navigateTo('#/');
        } catch (err) {
            adminAuthSubmit.disabled = false;
            adminAuthSubmit.textContent = '로그인';
            alert(translateError(err) || '오류가 발생했습니다.');
        }
    });
}

// 라우팅
const routes = {
    '#/': renderHome,
    '#/requests': renderRequests,
    '#/new-request': renderNewRequest,
    '#/search': renderSearch,
    '#/profile': renderProfile,
    '#/customer': renderCustomer,
    '#/report': renderReport,
    '#/admin': renderAdmin,
};

function setupRouting() {
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
}

function navigateTo(hash) {
    if (location.hash !== hash) {
        location.hash = hash;
    } else {
        handleRoute();
    }
}

function handleRoute() {
    const app = document.getElementById('app');
    const hash = location.hash || '#/';
    const hashPath = hash.split('?')[0]; // 쿼리 파라미터 제거
    
    // 동적 라우트 처리 (#/user/... 형태)
    if (hashPath.startsWith('#/user/')) {
        const userId = hashPath.replace('#/user/', '');
        if (userId) {
            renderUserProfile(app, userId).catch((e) => {
                app.innerHTML = `<div class="card"><h3>오류</h3><p class="muted">${escapeHtml(translateError(e))}</p></div>`;
            });
            updateActiveNav('#/search'); // 검색 페이지를 활성화로 표시
            return;
        }
    }
    
    // 의뢰 신청자 목록 페이지 (#/requests/:id/applications)
    if (hashPath.match(/^#\/requests\/[^\/]+\/applications$/)) {
        const match = hashPath.match(/^#\/requests\/([^\/]+)\/applications$/);
        if (match && match[1]) {
            const requestId = match[1];
            renderRequestApplications(app, requestId).catch((e) => {
                app.innerHTML = `<div class="card"><h3>오류</h3><p class="muted">${escapeHtml(translateError(e))}</p></div>`;
            });
            updateActiveNav('#/requests');
            return;
        }
    }
    
    const page = routes[hashPath] || routes['#/'];
    
    // 활성화된 네비게이션 링크 표시
    updateActiveNav(hashPath);
    
    page(app).catch((e) => {
        app.innerHTML = `<div class="card"><h3>오류</h3><p class="muted">${escapeHtml(translateError(e))}</p></div>`;
    });
}

function updateActiveNav(hash) {
    // 모든 네비게이션 링크에서 active 클래스 제거
    document.querySelectorAll('.nav a').forEach(link => {
        link.classList.remove('active');
    });
    
    // 현재 해시에 맞는 링크 찾기
    const navLinks = document.querySelectorAll('.nav a[href]');
    navLinks.forEach(link => {
        const linkHash = link.getAttribute('href');
        // 정확히 일치하거나, 홈(#/)인 경우 브랜드 링크도 활성화
        if (linkHash === hash || (hash === '#/' && linkHash === '#/')) {
            link.classList.add('active');
        }
    });
    
    // 홈 페이지인 경우 브랜드 링크도 활성화
    if (hash === '#/') {
        const brandLink = document.querySelector('.brand');
        if (brandLink) brandLink.classList.add('active');
    } else {
        const brandLink = document.querySelector('.brand');
        if (brandLink) brandLink.classList.remove('active');
    }
}

// 홈
async function renderHome(root) {
    const user = state.session?.user;
    root.innerHTML = `
    <section class="grid cols-2">
      <div class="card">
        <h3>의뢰 찾기</h3>
        <p class="muted">검색과 필터를 사용해 원하는 의뢰를 찾아보세요.</p>
        <div class="spacer"></div>
        <button class="btn btn-primary" id="goRequests">의뢰 리스트 보기</button>
      </div>
      <div class="card">
        <h3>${user ? '환영합니다!' : '로그인이 필요합니다'}</h3>
        <p class="muted">${user ? user.email : '프로필, 리뷰 작성은 로그인 후 이용할 수 있어요.'}</p>
      </div>
    </section>
  `;
    document.getElementById('goRequests').addEventListener('click', () => navigateTo('#/requests'));
}

// 의뢰 리스트 + 검색/필터
async function renderRequests(root) {
    const q = new URLSearchParams(location.search);
    root.innerHTML = `
    <div class="card">
      <div class="row wrap">
        <div class="field" style="min-width:220px;flex:1">
          <label for="search">검색</label>
          <input id="search" placeholder="제목, 내용으로 검색" value="${q.get('q') || ''}">
        </div>
        <div class="field" style="min-width:160px">
          <label for="category">카테고리</label>
          <select id="category">
            <option value="">전체</option>
            <option>디자인</option>
            <option>개발</option>
            <option>번역</option>
            <option>컨설팅</option>
          </select>
        </div>
        <div class="field" style="min-width:160px">
          <label for="minRating">최소 평점</label>
          <select id="minRating">
            <option value="">상관없음</option>
            <option value="5">5.0</option>
            <option value="4">4.0+</option>
            <option value="3">3.0+</option>
          </select>
        </div>
        <span class="space"></span>
        <button class="btn btn-primary" id="applyFilters">검색</button>
      </div>
    </div>
    <div class="spacer"></div>
    <div class="list" id="requestList"></div>
  `;

    document.getElementById('applyFilters').addEventListener('click', () => loadRequests());
    document.getElementById('search').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            loadRequests();
        }
    });
    await loadRequests();

    async function loadRequests() {
        const search = document.getElementById('search').value.trim();
        const category = document.getElementById('category').value;
        const minRating = document.getElementById('minRating').value;

        let query = state.supabase.from('requests_view').select('*').order('created_at', { ascending: false }).limit(50);
        if (search) {
            const encoded = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
            query = query.or(`title.ilike.%${encoded}%,summary.ilike.%${encoded}%`);
        }
        if (category) {
            query = query.eq('category', category);
        }
        if (minRating) {
            query = query.gte('avg_rating', Number(minRating));
        }

        const { data, error } = await query;
        const list = document.getElementById('requestList');
        if (error) {
            list.innerHTML = `<div class="card"><p class="muted">불러오기 실패: ${escapeHtml(translateError(error))}</p></div>`;
            return;
        }
        if (!data || data.length === 0) {
            list.innerHTML = `<div class="card"><p class="muted">결과가 없습니다.</p></div>`;
            return;
        }
        // 작성자 핸들 조회
        let handlesByUserId = {};
        try {
            const ids = Array.from(new Set(data.map((d) => d.owner_user_id))).filter(Boolean);
            if (ids.length) {
                const { data: profs } = await state.supabase.from('profiles').select('user_id, handle').in('user_id', ids);
                (profs || []).forEach(p => { if (p.handle) handlesByUserId[p.user_id] = p.handle; });
            }
        } catch(_) {}
        
        // 이미 신청한 의뢰 확인 (로그인한 경우만)
        let applicationStatusByRequestId = {};
        if (state.session) {
            try {
                const requestIds = data.map(d => d.id);
                const { data: applications } = await state.supabase
                    .from('request_applications')
                    .select('request_id, status')
                    .eq('applicant_user_id', state.session.user.id)
                    .in('request_id', requestIds);
                (applications || []).forEach(app => {
                    applicationStatusByRequestId[app.request_id] = app.status;
                });
            } catch(_) {}
        }
        
        list.innerHTML = data.map((item) => renderRequestItem(item, handlesByUserId, applicationStatusByRequestId[item.id])).join('');
        document.querySelectorAll('[data-action="send-message"]').forEach((btn) => btn.addEventListener('click', onClickSendMessage));
        document.querySelectorAll('[data-action="view-messages"]').forEach((btn) => btn.addEventListener('click', onClickViewMessages));
        document.querySelectorAll('[data-action="view-reviews"]').forEach((btn) => btn.addEventListener('click', onClickViewReviews));
        document.querySelectorAll('[data-action="review"]').forEach((btn) => btn.addEventListener('click', onClickReview));
        document.querySelectorAll('[data-action="apply-request"]').forEach((btn) => btn.addEventListener('click', onClickApplyRequest));
        document.querySelectorAll('[data-action="view-applications"]').forEach((btn) => btn.addEventListener('click', onClickViewApplications));
        document.querySelectorAll('[data-action="delete"]').forEach((btn) => btn.addEventListener('click', onClickDelete));
    }

    function renderRequestItem(item, handlesByUserId, applicationStatus) {
        const rating = item.avg_rating ? Number(item.avg_rating).toFixed(1) : '-';
        const isOwner = !!state.session && state.session.user.id === item.owner_user_id;
        const handle = handlesByUserId?.[item.owner_user_id] || (item.owner_user_id ? item.owner_user_id.slice(0,8) : '-');
        
        // 신청 버튼 텍스트 결정
        let applyButtonText = '의뢰 받기';
        let applyButtonDisabled = false;
        let applyButtonClass = 'btn btn-primary';
        if (applicationStatus === 'pending') {
            applyButtonText = '신청 대기 중';
            applyButtonDisabled = true;
            applyButtonClass = 'btn';
        } else if (applicationStatus === 'accepted') {
            applyButtonText = '수락됨 ✓';
            applyButtonDisabled = true;
            applyButtonClass = 'btn';
        } else if (applicationStatus === 'rejected') {
            applyButtonText = '의뢰 받기 (재신청)';
            applyButtonClass = 'btn';
        }
        
        return `
      <div class="list-item">
        <div>
          <h4 style="margin:0 0 4px">${escapeHtml(item.title)}</h4>
          <div class="muted" style="margin-bottom:6px">${escapeHtml(item.summary || '')}</div>
          <div class="row" style="gap:8px">
            <span class="chip">${escapeHtml(item.category || '기타')}</span>
            <span class="chip"><span class="rating">★</span> ${rating}</span>
            <span class="chip">작성자: ${escapeHtml(handle)}</span>
          </div>
        </div>
        <div class="row">
          ${state.session ? `<button class="btn" data-action="${isOwner ? 'view-messages' : 'send-message'}" data-request-id="${item.id}" data-request-title="${escapeHtml(item.title)}" data-receiver-id="${item.owner_user_id}" data-receiver-handle="${escapeHtml(handle)}">${isOwner ? '메시지 보기' : '메시지 보내기'}</button>` : ''}
          <button class="btn" data-action="view-reviews" data-user-id="${item.owner_user_id}" data-user-handle="${handle}">작성자 리뷰</button>
          ${!isOwner && state.session ? `<button class="${applyButtonClass}" data-action="apply-request" data-request-id="${item.id}" data-request-title="${escapeHtml(item.title)}" ${applyButtonDisabled ? 'disabled' : ''}>${applyButtonText}</button>` : ''}
          ${!isOwner && state.session ? `<button class="btn" data-action="review" data-user-id="${item.owner_user_id}">리뷰 남기기</button>` : ''}
          ${isOwner ? `<button class="btn" data-action="view-applications" data-request-id="${item.id}" data-request-title="${escapeHtml(item.title)}">신청자 보기</button>` : ''}
          ${isOwner || state.isAdmin ? `<button class="btn btn-danger" data-action="delete" data-id="${item.id}" data-title="${escapeHtml(item.title)}">삭제</button>` : ''}
        </div>
      </div>
    `;
    }

    function onClickSendMessage(e) {
        const receiverId = e.currentTarget.getAttribute('data-receiver-id');
        const receiverHandle = e.currentTarget.getAttribute('data-receiver-handle');
        const requestId = e.currentTarget.getAttribute('data-request-id');
        const requestTitle = e.currentTarget.getAttribute('data-request-title');
        openMessagesDialog(receiverId, receiverHandle, requestId, requestTitle);
    }
    
    async function onClickViewMessages(e) {
        const requestId = e.currentTarget.getAttribute('data-request-id');
        const requestTitle = e.currentTarget.getAttribute('data-request-title');
        await openRequestMessagesDialog(requestId, requestTitle);
    }

    function onClickViewReviews(e) {
        const userId = e.currentTarget.getAttribute('data-user-id');
        const userHandle = e.currentTarget.getAttribute('data-user-handle');
        openReviewsViewDialog(userId, userHandle);
    }

    function onClickReview(e) {
        if (!state.session) {
            alert('로그인이 필요합니다');
            return;
        }
        const reviewedUserId = e.currentTarget.getAttribute('data-user-id');
        openReviewDialog(reviewedUserId);
    }

    async function onClickApplyRequest(e) {
        console.log('의뢰 받기 버튼 클릭됨', e);
        
        if (!state.session) {
            alert('로그인이 필요합니다');
            return;
        }
        
        // 이벤트 타겟 안전하게 가져오기
        const target = e.currentTarget || e.target || (e.target?.closest('[data-action="apply-request"]'));
        if (!target) {
            console.error('버튼을 찾을 수 없습니다:', e);
            alert('오류가 발생했습니다. 페이지를 새로고침해주세요.');
            return;
        }
        
        const requestId = target.getAttribute('data-request-id');
        const requestTitle = target.getAttribute('data-request-title');
        
        if (!requestId) {
            alert('의뢰 ID를 찾을 수 없습니다.');
            console.error('requestId 없음:', target);
            return;
        }
        
        console.log('의뢰 신청 시도:', { requestId, requestTitle, userId: state.session.user.id });
        
        // 이미 신청했는지 확인 (오류 무시하고 진행)
        let existing = null;
        let checkError = null;
        try {
            const { data, error } = await state.supabase
                .from('request_applications')
                .select('id, status')
                .eq('request_id', requestId)
                .eq('applicant_user_id', state.session.user.id)
                .maybeSingle();
            existing = data;
            checkError = error;
            if (error) {
                console.warn('신청 상태 확인 오류:', error);
            }
        } catch(err) {
            // 테이블이 없어도 계속 진행 (신청 시도)
            console.warn('신청 상태 확인 실패:', err);
            checkError = err;
        }
        
        if (existing) {
            if (existing.status === 'accepted') {
                alert('이미 수락된 의뢰입니다.');
            } else if (existing.status === 'pending') {
                alert('이미 신청한 의뢰입니다.\n의뢰 작성자가 수락할 때까지 기다려주세요.');
            } else if (existing.status === 'rejected') {
                if (confirm('거절된 의뢰입니다. 다시 신청하시겠습니까?')) {
                    const { error } = await state.supabase
                        .from('request_applications')
                        .update({ status: 'pending', created_at: new Date().toISOString() })
                        .eq('id', existing.id);
                    
                    if (error) {
                        alert('신청 실패: ' + translateError(error));
                        return;
                    }
                    alert('의뢰 신청이 접수되었습니다.');
                    const target = e.currentTarget || e.target || (e.target?.closest('[data-action="apply-request"]'));
                    if (target) {
                        target.textContent = '신청 대기 중';
                        target.disabled = true;
                        target.classList.remove('btn-primary');
                        target.classList.add('btn');
                    }
                    await loadRequests();
                }
            }
            return;
        }
        
        if (!confirm(`"${requestTitle}" 의뢰를 받겠습니까?\n\n의뢰 작성자가 수락하면 의뢰가 성사됩니다.`)) return;
        
        // 이벤트 타겟 안전하게 가져오기
        const applyBtn = e.currentTarget || e.target || (e.target?.closest('[data-action="apply-request"]'));
        if (!applyBtn) {
            console.error('버튼을 찾을 수 없습니다:', e);
            alert('오류가 발생했습니다. 페이지를 새로고침해주세요.');
            return;
        }
        
        const originalText = applyBtn.textContent || '의뢰 받기';
        applyBtn.disabled = true;
        applyBtn.textContent = '신청 중...';
        
        console.log('신청 INSERT 시도 중...');
        const { data: insertData, error } = await state.supabase
            .from('request_applications')
            .insert({
                request_id: requestId,
                applicant_user_id: state.session.user.id,
                status: 'pending'
            })
            .select();
        
        console.log('INSERT 결과:', { data: insertData, error });
        
        if (error) {
            // 버튼이 여전히 존재하는지 확인
            if (applyBtn && applyBtn.parentElement) {
                applyBtn.disabled = false;
                applyBtn.textContent = originalText;
            }
            
            const errorMsg = translateError(error);
            const fullError = error.message || String(error);
            console.error('의뢰 신청 오류 상세:', { error, fullError, errorMsg });
            
            if (fullError.includes('schema cache') || fullError.includes('Could not find') || fullError.includes('does not exist')) {
                alert(`테이블을 찾을 수 없습니다.\n\nSupabase SQL Editor에서 request_applications 테이블을 생성해야 합니다.\n\n테이블 생성 SQL:\n\nCREATE TABLE IF NOT EXISTS request_applications (\n  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,\n  applicant_user_id UUID NOT NULL,\n  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),\n  created_at TIMESTAMPTZ DEFAULT NOW(),\n  updated_at TIMESTAMPTZ DEFAULT NOW()\n);\n\nCREATE INDEX IF NOT EXISTS idx_request_applications_request_id ON request_applications(request_id);\nCREATE INDEX IF NOT EXISTS idx_request_applications_applicant ON request_applications(applicant_user_id);\n\nALTER TABLE request_applications ENABLE ROW LEVEL SECURITY;\n\n-- 기존 정책 삭제 후 재생성\nDROP POLICY IF EXISTS "Anyone can apply" ON request_applications;\nDROP POLICY IF EXISTS "Users can view own applications or requests" ON request_applications;\nDROP POLICY IF EXISTS "Request owners can update applications" ON request_applications;\n\nCREATE POLICY "Anyone can apply" ON request_applications\n  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND applicant_user_id = auth.uid());\n\nCREATE POLICY "Users can view own applications or requests" ON request_applications\n  FOR SELECT USING (\n    applicant_user_id = auth.uid() OR\n    EXISTS (\n      SELECT 1 FROM requests \n      WHERE requests.id = request_applications.request_id \n      AND requests.owner_user_id = auth.uid()\n    )\n  );\n\nCREATE POLICY "Request owners can update applications" ON request_applications\n  FOR UPDATE USING (\n    EXISTS (\n      SELECT 1 FROM requests \n      WHERE requests.id = request_applications.request_id \n      AND requests.owner_user_id = auth.uid()\n    )\n  );`);
            } else if (fullError.includes('permission denied') || fullError.includes('policy') || fullError.includes('RLS')) {
                alert(`권한이 없습니다.\n\nRLS 정책을 확인해주세요.\n\nSupabase SQL Editor에서 다음을 실행하세요:\n\n-- 기존 정책 삭제 후 재생성\nDROP POLICY IF EXISTS "Anyone can apply" ON request_applications;\n\nCREATE POLICY "Anyone can apply" ON request_applications\n  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND applicant_user_id = auth.uid());\n\n상세 오류: ${fullError}`);
            } else {
                alert(`신청 실패: ${errorMsg}\n\n상세 오류: ${fullError}\n\n콘솔(F12)에서 더 자세한 정보를 확인할 수 있습니다.`);
            }
            return;
        }
        
        console.log('신청 성공:', insertData);
        
        alert('의뢰 신청이 접수되었습니다.\n의뢰 작성자가 수락하면 의뢰가 성사됩니다.');
        
        // 버튼이 여전히 존재하는지 확인
        if (applyBtn && applyBtn.parentElement) {
            applyBtn.textContent = '신청 대기 중';
            applyBtn.disabled = true;
            applyBtn.classList.remove('btn-primary');
            applyBtn.classList.add('btn');
        }
        
        // 목록 새로고침하여 버튼 상태 업데이트
        await loadRequests();
    }

    function onClickViewApplications(e) {
        if (!state.session) {
            alert('로그인이 필요합니다');
            return;
        }
        const requestId = e.currentTarget.getAttribute('data-request-id');
        navigateTo(`#/requests/${requestId}/applications`);
    }

    async function onClickDelete(e) {
        if (!state.session) {
            alert('로그인이 필요합니다');
            return;
        }
        const id = e.currentTarget.getAttribute('data-id');
        const title = e.currentTarget.getAttribute('data-title') || '이 의뢰';
        if (!id) return;
        
        const isAdminDelete = state.isAdmin;
        const confirmMsg = isAdminDelete 
            ? `정말 "${title}" 의뢰를 삭제하시겠습니까?\n\n(관리자 권한으로 삭제됩니다.)`
            : `정말 "${title}" 의뢰를 삭제하시겠습니까?\n\n삭제된 의뢰는 복구할 수 없습니다.`;
        
        if (!confirm(confirmMsg)) return;
        
        const deleteBtn = e.currentTarget;
        const originalText = deleteBtn.textContent;
        deleteBtn.disabled = true;
        deleteBtn.textContent = '삭제 중...';
        
        let query = state.supabase
            .from('requests')
            .delete()
            .eq('id', id);
        
        // 관리자가 아니면 본인 의뢰만 삭제 가능
        if (!isAdminDelete) {
            query = query.eq('owner_user_id', state.session.user.id);
        }
        
        const { error } = await query.select('id');
            
        deleteBtn.disabled = false;
        deleteBtn.textContent = originalText;
        
        if (error) {
            const errorMsg = translateError(error);
            const fullError = error.message || String(error);
            console.error('의뢰 삭제 오류:', error);
            
            if (fullError.includes('permission denied') || fullError.includes('policy') || fullError.includes('RLS')) {
                if (isAdminDelete) {
                    alert(`삭제 권한이 없습니다.\n\n관리자 권한으로 삭제하려면 Supabase에서 RLS 정책을 설정해야 합니다.\n\nSupabase SQL Editor에서 다음을 실행하세요:\n\n-- 기존 정책이 있으면 삭제 후 재생성\nDROP POLICY IF EXISTS "Admins can delete any request" ON requests;\n\nCREATE POLICY "Admins can delete any request" ON requests\n  FOR DELETE USING (\n    auth.jwt() ->> 'email' IN ('wjekzzz@gmail.com')\n  );`);
                } else {
                    alert('삭제 권한이 없습니다.\n\n본인이 작성한 의뢰만 삭제할 수 있습니다.');
                }
            } else {
                alert(`삭제 실패: ${errorMsg}\n\n상세 오류:\n${fullError}\n\n콘솔에서 더 자세한 정보를 확인할 수 있습니다.`);
            }
            return;
        }
        
        alert('의뢰가 삭제되었습니다.');
        // 목록 새로고침
        await loadRequests();
    }
}

// 의뢰 작성 (로그인 필요)
async function renderNewRequest(root) {
    if (!state.session) {
        root.innerHTML = `<div class="card"><h3>로그인이 필요합니다</h3><p class="muted">의뢰 작성은 로그인 후 이용할 수 있어요.</p></div>`;
        return;
    }
    root.innerHTML = `
    <div class="card">
      <h3>의뢰 작성</h3>
      <div class="grid">
        <div class="field">
          <label>제목</label>
          <input id="reqTitle" placeholder="예: 로고 디자인 의뢰">
        </div>
        <div class="field">
          <label>카테고리</label>
          <select id="reqCategory">
            <option value="">선택</option>
            <option>디자인</option>
            <option>개발</option>
            <option>번역</option>
            <option>컨설팅</option>
          </select>
        </div>
        <div class="field">
          <label>요약</label>
          <textarea id="reqSummary" placeholder="간단한 요구사항을 적어주세요"></textarea>
        </div>
        <div class="row" style="justify-content:flex-end;gap:8px">
          <button class="btn" id="cancelNewReq">취소</button>
          <button class="btn btn-primary" id="submitNewReq">등록</button>
        </div>
      </div>
    </div>
  `;

    document.getElementById('cancelNewReq').addEventListener('click', () => navigateTo('#/requests'));
    document.getElementById('submitNewReq').addEventListener('click', submitNewRequest);

    async function submitNewRequest() {
        const title = document.getElementById('reqTitle').value.trim();
        const category = document.getElementById('reqCategory').value.trim();
        const summary = document.getElementById('reqSummary').value.trim();
        if (!title || !category) {
            alert('제목과 카테고리를 입력하세요.');
            return;
        }
        const payload = {
            owner_user_id: state.session.user.id,
            title,
            summary,
            category,
        };
        const { error } = await state.supabase.from('requests').insert(payload);
        if (error) {
            alert('등록 실패: ' + translateError(error));
            return;
        }
        alert('의뢰가 등록되었습니다.');
        navigateTo('#/requests');
    }
}

// 검색 기록 관련 함수들 (외부에서 사용)
function getSearchHistory() {
    try {
        const history = localStorage.getItem('userSearchHistory');
        return history ? JSON.parse(history) : [];
    } catch(_) {
        return [];
    }
}

function saveSearchHistory(query) {
    try {
        let history = getSearchHistory();
        // 중복 제거 (기존 항목 삭제 후 앞에 추가)
        history = history.filter(term => term !== query);
        history.unshift(query); // 앞에 추가
        // 최대 10개까지만 저장
        history = history.slice(0, 10);
        localStorage.setItem('userSearchHistory', JSON.stringify(history));
    } catch(_) {}
}

function removeFromHistory(term) {
    try {
        let history = getSearchHistory();
        history = history.filter(t => t !== term);
        localStorage.setItem('userSearchHistory', JSON.stringify(history));
    } catch(_) {}
}

function clearSearchHistory() {
    try {
        localStorage.removeItem('userSearchHistory');
    } catch(_) {}
}

// 의뢰 신청자 목록 페이지
async function renderRequestApplications(root, requestId) {
    if (!state.session) {
        root.innerHTML = `<div class="card"><h3>로그인이 필요합니다</h3><p class="muted">의뢰 신청자 목록을 보려면 로그인이 필요합니다.</p></div>`;
        return;
    }

    root.innerHTML = '<div class="card"><p class="muted" style="text-align:center;padding:20px">로딩 중...</p></div>';

    try {
        // 의뢰 정보 가져오기
        const { data: request, error: reqErr } = await state.supabase
            .from('requests')
            .select('id, title, owner_user_id')
            .eq('id', requestId)
            .maybeSingle();

        if (reqErr || !request) {
            root.innerHTML = `<div class="card"><h3>의뢰를 찾을 수 없습니다</h3><p class="muted">${escapeHtml(translateError(reqErr))}</p></div>`;
            return;
        }

        // 본인의 의뢰인지 확인
        if (request.owner_user_id !== state.session.user.id && !state.isAdmin) {
            root.innerHTML = `<div class="card"><h3>권한이 없습니다</h3><p class="muted">본인이 작성한 의뢰의 신청자만 확인할 수 있습니다.</p></div>`;
            return;
        }

        // 신청자 목록 가져오기
        const { data: applications, error: appErr } = await state.supabase
            .from('request_applications')
            .select('*')
            .eq('request_id', requestId)
            .order('created_at', { ascending: false });

        if (appErr) {
            const fullError = appErr.message || String(appErr);
            if (fullError.includes('schema cache') || fullError.includes('Could not find') || fullError.includes('does not exist')) {
                root.innerHTML = `
                    <div class="card" style="padding:20px">
                        <h3>테이블을 찾을 수 없습니다</h3>
                        <p class="muted" style="margin-bottom:12px">request_applications 테이블이 필요합니다.</p>
                        <details style="margin-top:12px">
                            <summary style="cursor:pointer;color:var(--primary);font-size:12px">RLS 정책 설정 SQL 보기 (테이블이 이미 있는 경우)</summary>
                            <pre style="background:#0c111a;padding:12px;border-radius:8px;overflow-x:auto;text-align:left;font-size:11px;margin-top:8px">
-- request_applications 테이블이 이미 있는 경우, 아래 RLS 정책만 실행하세요.

-- 기존 정책 삭제 (안전하게 처리)
DROP POLICY IF EXISTS "Anyone can apply" ON request_applications;
DROP POLICY IF EXISTS "Users can view own applications or requests" ON request_applications;
DROP POLICY IF EXISTS "Request owners can update applications" ON request_applications;

-- RLS 활성화 확인
ALTER TABLE request_applications ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 신청 조회 가능 (본인 신청 또는 본인 의뢰)
CREATE POLICY "Users can view own applications or requests" ON request_applications
  FOR SELECT USING (
    applicant_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM requests 
      WHERE requests.id = request_applications.request_id 
      AND requests.owner_user_id = auth.uid()
    )
  );

-- 모든 사용자가 신청 가능
CREATE POLICY "Anyone can apply" ON request_applications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND applicant_user_id = auth.uid());

-- 의뢰 작성자만 신청 수락/거절 가능
CREATE POLICY "Request owners can update applications" ON request_applications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM requests 
      WHERE requests.id = request_applications.request_id 
      AND requests.owner_user_id = auth.uid()
    )
  );
                            </pre>
                        </details>
                        <p class="muted" style="font-size:11px;margin-top:12px">오류: ${escapeHtml(fullError)}</p>
                        <div class="row" style="justify-content:flex-end;margin-top:16px">
                            <button class="btn" onclick="location.reload()">새로고침</button>
                        </div>
                    </div>
                `;
            } else {
                root.innerHTML = `<div class="card"><h3>오류</h3><p class="muted">${escapeHtml(translateError(appErr))}</p></div>`;
            }
            return;
        }

        // 신청자 핸들 정보 가져오기
        const applicantIds = (applications || []).map(a => a.applicant_user_id).filter(Boolean);
        let handlesByUserId = {};
        if (applicantIds.length > 0) {
            try {
                const { data: profs } = await state.supabase
                    .from('profiles')
                    .select('user_id, handle')
                    .in('user_id', applicantIds);
                (profs || []).forEach(p => {
                    if (p.handle) handlesByUserId[p.user_id] = p.handle;
                });
            } catch(_) {}
        }

        const pendingApps = (applications || []).filter(a => a.status === 'pending');
        const acceptedApps = (applications || []).filter(a => a.status === 'accepted');
        const rejectedApps = (applications || []).filter(a => a.status === 'rejected');

        root.innerHTML = `
        <div class="card">
          <h3>"${escapeHtml(request.title)}" 신청자</h3>
          <div class="row" style="justify-content:flex-end;margin-top:12px">
            <button class="btn" id="backToRequests">의뢰 리스트로 돌아가기</button>
          </div>
        </div>
        ${pendingApps.length > 0 ? `
        <div class="spacer"></div>
        <div class="card">
          <h3>대기 중인 신청 (${pendingApps.length})</h3>
          <div class="list" id="pendingApplications">
            ${pendingApps.map(app => {
                const handle = handlesByUserId[app.applicant_user_id] || app.applicant_user_id?.slice(0, 8) || '익명';
                const date = new Date(app.created_at).toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                return `
                    <div class="list-item">
                        <div style="flex:1">
                            <div style="margin-bottom:4px">
                                <strong>${escapeHtml(handle)}</strong>
                                <span class="muted" style="font-size:12px"> · ${date}</span>
                            </div>
                            <div class="chip" style="background:var(--warn);opacity:0.8">대기 중</div>
                        </div>
                        <div class="row" style="gap:8px">
                            <button class="btn btn-primary" data-action="accept-application" data-app-id="${app.id}" data-applicant-id="${app.applicant_user_id}" data-applicant-handle="${escapeHtml(handle)}">수락</button>
                            <button class="btn" data-action="reject-application" data-app-id="${app.id}">거절</button>
                        </div>
                    </div>
                `;
            }).join('')}
          </div>
        </div>
        ` : ''}
        ${acceptedApps.length > 0 ? `
        <div class="spacer"></div>
        <div class="card">
          <h3>수락된 신청 (${acceptedApps.length})</h3>
          <div class="list" id="acceptedApplications">
            ${acceptedApps.map(app => {
                const handle = handlesByUserId[app.applicant_user_id] || app.applicant_user_id?.slice(0, 8) || '익명';
                const date = new Date(app.created_at).toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                return `
                    <div class="list-item">
                        <div style="flex:1">
                            <div style="margin-bottom:4px">
                                <strong>${escapeHtml(handle)}</strong>
                                <span class="muted" style="font-size:12px"> · ${date}</span>
                            </div>
                            <div class="chip" style="background:var(--primary);opacity:0.8">수락됨</div>
                        </div>
                        <button class="btn" data-action="view-applicant-profile" data-user-id="${app.applicant_user_id}">프로필 보기</button>
                    </div>
                `;
            }).join('')}
          </div>
        </div>
        ` : ''}
        ${rejectedApps.length > 0 ? `
        <div class="spacer"></div>
        <div class="card">
          <h3>거절된 신청 (${rejectedApps.length})</h3>
          <div class="list" id="rejectedApplications">
            ${rejectedApps.map(app => {
                const handle = handlesByUserId[app.applicant_user_id] || app.applicant_user_id?.slice(0, 8) || '익명';
                const date = new Date(app.created_at).toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                return `
                    <div class="list-item">
                        <div style="flex:1">
                            <div style="margin-bottom:4px">
                                <strong>${escapeHtml(handle)}</strong>
                                <span class="muted" style="font-size:12px"> · ${date}</span>
                            </div>
                            <div class="chip muted">거절됨</div>
                        </div>
                    </div>
                `;
            }).join('')}
          </div>
        </div>
        ` : ''}
        ${applications.length === 0 ? `
        <div class="spacer"></div>
        <div class="card">
          <p class="muted" style="text-align:center;padding:20px">아직 신청자가 없습니다.</p>
        </div>
        ` : ''}
      `;

        // 뒤로 가기 버튼
        document.getElementById('backToRequests').addEventListener('click', () => {
            navigateTo('#/requests');
        });

        // 수락 버튼
        document.querySelectorAll('[data-action="accept-application"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const appId = e.target.getAttribute('data-app-id');
                const applicantId = e.target.getAttribute('data-applicant-id');
                const applicantHandle = e.target.getAttribute('data-applicant-handle');
                
                if (!confirm(`"${escapeHtml(applicantHandle)}"님의 신청을 수락하시겠습니까?\n\n수락하면 다른 대기 중인 신청은 자동으로 거절됩니다.`)) return;
                
                const acceptBtn = e.target;
                const originalText = acceptBtn.textContent;
                acceptBtn.disabled = true;
                acceptBtn.textContent = '처리 중...';
                
                try {
                    // 모든 대기 중인 신청을 거절 (현재 신청 제외)
                    await state.supabase
                        .from('request_applications')
                        .update({ status: 'rejected' })
                        .eq('request_id', requestId)
                        .eq('status', 'pending')
                        .neq('id', appId);
                    
                    // 현재 신청 수락
                    const { error } = await state.supabase
                        .from('request_applications')
                        .update({ status: 'accepted' })
                        .eq('id', appId);
                    
                    if (error) {
                        alert('수락 실패: ' + translateError(error));
                        acceptBtn.disabled = false;
                        acceptBtn.textContent = originalText;
                        return;
                    }
                    
                    alert('의뢰 신청이 수락되었습니다.');
                    // 페이지 새로고침
                    renderRequestApplications(root, requestId);
                } catch (err) {
                    alert('오류 발생: ' + translateError(err));
                    acceptBtn.disabled = false;
                    acceptBtn.textContent = originalText;
                }
            });
        });

        // 거절 버튼
        document.querySelectorAll('[data-action="reject-application"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const appId = e.target.getAttribute('data-app-id');
                
                if (!confirm('이 신청을 거절하시겠습니까?')) return;
                
                const rejectBtn = e.target;
                const originalText = rejectBtn.textContent;
                rejectBtn.disabled = true;
                rejectBtn.textContent = '처리 중...';
                
                const { error } = await state.supabase
                    .from('request_applications')
                    .update({ status: 'rejected' })
                    .eq('id', appId);
                
                rejectBtn.disabled = false;
                rejectBtn.textContent = originalText;
                
                if (error) {
                    alert('거절 실패: ' + translateError(error));
                    return;
                }
                
                alert('의뢰 신청이 거절되었습니다.');
                // 페이지 새로고침
                renderRequestApplications(root, requestId);
            });
        });

        // 프로필 보기 버튼
        document.querySelectorAll('[data-action="view-applicant-profile"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.target.getAttribute('data-user-id');
                navigateTo(`#/user/${userId}`);
            });
        });
    } catch (err) {
        root.innerHTML = `<div class="card"><h3>오류</h3><p class="muted">${escapeHtml(translateError(err))}</p></div>`;
    }
}

// 사용자 검색
async function renderSearch(root) {
    // 검색 기록 불러오기
    const searchHistory = getSearchHistory();
    
    root.innerHTML = `
    <div class="card">
      <h3>사용자 검색</h3>
      <div class="grid">
        <div class="field">
          <label>검색어 (핸들, 이메일, 사용자 ID)</label>
          <input id="searchQuery" placeholder="사용자 핸들이나 이메일을 입력하세요" style="width:100%">
        </div>
        <div class="row" style="justify-content:flex-end">
          <button class="btn btn-primary" id="searchBtn">검색</button>
        </div>
      </div>
      ${searchHistory.length > 0 ? `
      <div class="spacer"></div>
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <label style="font-size:13px;color:var(--muted)">최근 검색어</label>
          <button class="btn" id="clearHistory" style="height:24px;padding:2px 8px;font-size:11px">전체 삭제</button>
        </div>
        <div class="row wrap" style="gap:6px" id="searchHistoryList">
          ${searchHistory.map(term => `
            <button class="chip" data-history-term="${escapeHtml(term)}" style="cursor:pointer;font-size:12px;padding:4px 10px">
              ${escapeHtml(term)}
              <span style="margin-left:6px;opacity:0.6">×</span>
            </button>
          `).join('')}
        </div>
      </div>
      ` : ''}
    </div>
    <div class="spacer"></div>
    <div class="card">
      <h3>검색 결과</h3>
      <div id="searchResults" class="list">
        <p class="muted" style="text-align:center;padding:20px">검색어를 입력하고 검색 버튼을 클릭하세요.</p>
      </div>
    </div>
  `;

    const searchQuery = document.getElementById('searchQuery');
    const searchBtn = document.getElementById('searchBtn');
    const searchResults = document.getElementById('searchResults');

    // 검색 기록 클릭 이벤트
    const historyList = document.getElementById('searchHistoryList');
    if (historyList) {
        historyList.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-history-term]');
            if (!btn) return;
            
            const term = btn.getAttribute('data-history-term');
            // × 클릭 시 삭제
            if (e.target.textContent === '×' || e.target.tagName === 'SPAN') {
                removeFromHistory(term);
                btn.remove();
                // 검색 기록이 모두 삭제되면 섹션도 제거
                const remaining = historyList.querySelectorAll('[data-history-term]');
                if (remaining.length === 0) {
                    const card = historyList.closest('.card');
                    const historySection = historyList.closest('.spacer')?.previousElementSibling || 
                                         (historyList.parentElement.parentElement);
                    if (historySection && historySection !== card) {
                        historySection.remove();
                    }
                    historyList.parentElement.remove();
                }
            } else {
                // 검색어 클릭 시 검색 실행
                searchQuery.value = term;
                performSearch();
            }
        });
    }

    // 전체 삭제 버튼
    const clearHistoryBtn = document.getElementById('clearHistory');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', () => {
            if (confirm('검색 기록을 모두 삭제하시겠습니까?')) {
                clearSearchHistory();
                const historySection = clearHistoryBtn.closest('.spacer')?.previousElementSibling;
                if (historySection && historySection.id !== 'searchQuery') {
                    const spacer = clearHistoryBtn.closest('.spacer');
                    if (spacer) spacer.remove();
                    if (historySection && !historySection.classList.contains('card')) {
                        historySection.remove();
                    }
                }
                const historyContainer = clearHistoryBtn.closest('div')?.parentElement;
                if (historyContainer && historyContainer !== searchQuery.parentElement) {
                    const spacer = document.createElement('div');
                    spacer.className = 'spacer';
                    historyContainer.replaceWith(spacer);
                }
                // 페이지 새로고침으로 깔끔하게 처리
                renderSearch(root);
            }
        });
    }

    async function performSearch() {
        const query = searchQuery.value.trim();
        if (!query) {
            alert('검색어를 입력해주세요.');
            return;
        }

        // 검색 기록 저장
        saveSearchHistory(query);

        searchBtn.disabled = true;
        searchBtn.textContent = '검색 중...';
        searchResults.innerHTML = '<p class="muted" style="text-align:center;padding:20px">검색 중...</p>';

        try {
            // profiles 테이블에서 핸들 또는 이메일로 검색
            let profiles = null;
            let error = null;
            
            // 먼저 profiles 테이블에서 검색 시도 (handle만 검색)
            const result = await state.supabase
                .from('profiles')
                .select('user_id, handle')
                .ilike('handle', `%${query}%`)
                .limit(50);
            
            profiles = result.data;
            error = result.error;

            // profiles 테이블에서 결과가 없거나 에러 발생 시 user_profiles_view에서 이메일 검색 시도
            if ((error && (error.message?.includes('schema cache') || error.message?.includes('Could not find') || error.message?.includes('does not exist') || error.message?.includes('permission denied') || error.message?.includes('policy') || error.message?.includes('does not exist'))) || (!profiles || profiles.length === 0)) {
                console.warn('profiles 테이블에서 검색 결과 없음 또는 오류, user_profiles_view로 이메일 검색 시도');
                
                // user_profiles_view에서 이메일 검색 시도
                const viewResult = await state.supabase
                    .from('user_profiles_view')
                    .select('user_id, email')
                    .ilike('email', `%${query}%`)
                    .limit(50);
                
                if (!viewResult.error && viewResult.data && viewResult.data.length > 0) {
                    // user_profiles_view 결과와 기존 profiles 결과 병합
                    const existingUserIds = new Set((profiles || []).map(p => p.user_id));
                    const viewProfiles = viewResult.data
                        .filter(u => !existingUserIds.has(u.user_id))
                        .map(u => ({
                            user_id: u.user_id,
                            handle: null,
                            email: u.email
                        }));
                    
                    profiles = [...(profiles || []), ...viewProfiles];
                    error = null;
                }
            }

            if (error) {
                const errorMsg = translateError(error);
                const fullError = error.message || String(error);
                console.error('사용자 검색 오류:', error);
                
                if (fullError.includes('schema cache') || fullError.includes('Could not find') || fullError.includes('does not exist')) {
                    searchResults.innerHTML = `
                        <div class="card" style="padding:20px;text-align:center">
                            <p class="muted" style="margin-bottom:12px;color:var(--warn);font-size:16px;font-weight:600">⚠️ profiles 테이블에 접근할 수 없습니다</p>
                            
                            <div style="background:#1a1f2e;padding:16px;border-radius:8px;margin:16px 0;text-align:left">
                                <p style="margin-bottom:12px;font-weight:600;color:var(--text)">🔍 Supabase 대시보드에서 확인할 사항:</p>
                                <ol style="text-align:left;font-size:13px;color:var(--muted);padding-left:24px;margin:0;line-height:1.8">
                                    <li>Supabase 대시보드 → <strong>Table Editor</strong>로 이동</li>
                                    <li>'<strong>profiles</strong>' 테이블이 있는지 확인</li>
                                    <li>테이블이 <strong>없다면</strong>: 아래 "테이블 생성 SQL" 실행</li>
                                    <li>테이블이 <strong>있다면</strong>: 아래 "RLS 정책 설정 SQL" 실행</li>
                                </ol>
                            </div>
                            
                            <details style="margin-top:12px;text-align:left">
                                <summary style="cursor:pointer;color:var(--primary);font-size:13px;font-weight:600;padding:8px;background:#1a1f2e;border-radius:4px">📋 테이블 생성 SQL (테이블이 없는 경우)</summary>
                                <pre style="background:#0c111a;padding:12px;border-radius:8px;overflow-x:auto;text-align:left;font-size:11px;margin-top:8px;border:1px solid var(--border)">
-- profiles 테이블 생성 (테이블이 없는 경우만 실행)
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_handle ON profiles(handle);

-- 참고: email은 auth.users에 이미 있으므로 profiles 테이블에 추가하지 않습니다.
-- 이메일 정보는 user_profiles_view를 통해 조회할 수 있습니다.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 profiles 조회 가능
CREATE POLICY "Anyone can view profiles" ON profiles
  FOR SELECT USING (true);

-- 본인 프로필만 수정 가능
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- 본인 프로필만 삽입 가능
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
                                </pre>
                            </details>
                            
                            <details style="margin-top:12px;text-align:left">
                                <summary style="cursor:pointer;color:var(--primary);font-size:13px;font-weight:600;padding:8px;background:#1a1f2e;border-radius:4px">🔐 RLS 정책 설정 SQL (테이블이 이미 있는 경우)</summary>
                                <pre style="background:#0c111a;padding:12px;border-radius:8px;overflow-x:auto;text-align:left;font-size:11px;margin-top:8px;border:1px solid var(--border)">
-- 1. 기존 정책 삭제 (안전하게 처리)
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- 2. RLS 활성화 (이미 활성화되어 있어도 안전)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. 모든 사용자가 profiles 조회 가능하도록 정책 생성
CREATE POLICY "Anyone can view profiles" ON profiles
  FOR SELECT USING (true);

-- 4. 본인 프로필 수정/삽입 정책
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
                                </pre>
                            </details>
                            
                            <div style="margin-top:16px;padding:12px;background:#1a1f2e;border-radius:8px">
                                <p style="margin-bottom:8px;font-weight:600;color:var(--text)">💡 해결 방법:</p>
                                <ol style="text-align:left;font-size:12px;color:var(--muted);padding-left:20px;margin:0;line-height:1.6">
                                    <li>위의 SQL 중 하나를 Supabase <strong>SQL Editor</strong>에서 실행</li>
                                    <li>Supabase 대시보드를 <strong>새로고침</strong> (F5)</li>
                                    <li>이 페이지를 새로고침하고 다시 검색 시도</li>
                                    <li>여전히 오류가 발생하면 브라우저 콘솔(F12) 확인</li>
                                </ol>
                            </div>
                            
                            <details style="margin-top:12px;text-align:left">
                                <summary style="cursor:pointer;color:var(--muted);font-size:11px">오류 상세 정보 보기</summary>
                                <p class="muted" style="font-size:11px;margin-top:8px;word-break:break-all;padding:8px;background:#0c111a;border-radius:4px">${escapeHtml(fullError)}</p>
                            </details>
                        </div>
                    `;
                } else if (fullError.includes('permission denied') || fullError.includes('policy') || fullError.includes('RLS')) {
                    searchResults.innerHTML = `
                        <div class="card" style="padding:20px;text-align:center">
                            <p class="muted" style="margin-bottom:12px;color:var(--warn)">⚠️ 권한이 없습니다</p>
                            <p class="muted" style="font-size:12px;margin-bottom:8px">profiles 테이블 조회 권한이 필요합니다.</p>
                            <details style="margin-top:12px;text-align:left">
                                <summary style="cursor:pointer;color:var(--primary);font-size:12px">RLS 정책 설정 SQL 보기</summary>
                                <pre style="background:#0c111a;padding:12px;border-radius:8px;overflow-x:auto;text-align:left;font-size:11px;margin-top:8px">
-- 모든 사용자가 profiles 조회 가능
CREATE POLICY "Anyone can view profiles" ON profiles
  FOR SELECT USING (true);
                                </pre>
                            </details>
                            <p class="muted" style="font-size:11px;margin-top:12px">오류 상세: ${escapeHtml(fullError)}</p>
                        </div>
                    `;
                } else {
                    searchResults.innerHTML = `<p class="muted">검색 실패: ${escapeHtml(errorMsg)}</p><p class="muted" style="font-size:11px;margin-top:8px">${escapeHtml(fullError)}</p>`;
                }
                return;
            }

            if (!profiles || profiles.length === 0) {
                searchResults.innerHTML = '<p class="muted" style="text-align:center;padding:20px">검색 결과가 없습니다.</p>';
                return;
            }

            // 사용자 프로필 정보 가져오기
            const userIds = profiles.map(p => p.user_id);
            const { data: userProfiles } = await state.supabase
                .from('user_profiles_view')
                .select('user_id, avg_rating')
                .in('user_id', userIds);

            const ratingMap = {};
            (userProfiles || []).forEach(up => {
                ratingMap[up.user_id] = up.avg_rating ? Number(up.avg_rating).toFixed(1) : '-';
            });

            // 프로필 정보 보강 (이메일 정보 가져오기)
            const profileUserIds = profiles.map(p => p.user_id);
            let emailsByUserId = {};
            if (profileUserIds.length > 0) {
                try {
                    const { data: viewData } = await state.supabase
                        .from('user_profiles_view')
                        .select('user_id, email')
                        .in('user_id', profileUserIds);
                    (viewData || []).forEach(v => {
                        if (v.email) emailsByUserId[v.user_id] = v.email;
                    });
                } catch(_) {}
            }

            searchResults.innerHTML = profiles.map(profile => {
                const rating = ratingMap[profile.user_id] || '-';
                const email = profile.email || emailsByUserId[profile.user_id] || null;
                const handle = profile.handle || email || profile.user_id?.slice(0, 8) || '익명';
                return `
                    <div class="list-item">
                        <div style="flex:1">
                            <div style="margin-bottom:4px">
                                <strong>${escapeHtml(handle)}</strong>
                                ${profile.handle ? '' : '<span class="muted" style="font-size:12px"> (핸들 없음)</span>'}
                            </div>
                            ${email ? `<div class="muted" style="font-size:12px;margin-bottom:4px">${escapeHtml(email)}</div>` : ''}
                            <div class="row" style="gap:8px">
                                <span class="chip"><span class="rating">★</span> ${rating}</span>
                            </div>
                        </div>
                        <button class="btn btn-primary" data-action="view-profile" data-user-id="${profile.user_id}" data-user-handle="${escapeHtml(handle)}">프로필 보기</button>
                    </div>
                `;
            }).join('');

            // 프로필 보기 버튼 이벤트
            searchResults.querySelectorAll('[data-action="view-profile"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const userId = e.target.getAttribute('data-user-id');
                    if (userId) {
                        navigateTo(`#/user/${userId}`);
                    }
                });
            });
        } catch (err) {
            searchResults.innerHTML = `<p class="muted">검색 중 오류가 발생했습니다: ${escapeHtml(translateError(err))}</p>`;
        } finally {
            searchBtn.disabled = false;
            searchBtn.textContent = '검색';
        }
    }

    searchBtn.addEventListener('click', performSearch);
    searchQuery.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
}

// 사용자 프로필 보기 (다른 사용자)
async function renderUserProfile(root, userId) {
    if (!userId) {
        root.innerHTML = `<div class="card"><h3>사용자를 찾을 수 없습니다</h3><p class="muted">사용자 ID가 올바르지 않습니다.</p></div>`;
        return;
    }

    root.innerHTML = '<div class="card"><p class="muted" style="text-align:center;padding:20px">프로필 로딩 중...</p></div>';

    try {
        const { data: profile, error: pErr } = await state.supabase
            .from('user_profiles_view')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (pErr) {
            root.innerHTML = `<div class="card"><p class="muted">프로필 로딩 실패: ${escapeHtml(translateError(pErr))}</p></div>`;
            return;
        }

        if (!profile) {
            root.innerHTML = `<div class="card"><h3>사용자를 찾을 수 없습니다</h3><p class="muted">해당 사용자의 프로필이 존재하지 않습니다.</p></div>`;
            return;
        }

        const { data: reviews, error: rErr } = await state.supabase
            .from('reviews_view')
            .select('*')
            .eq('reviewed_user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (rErr) {
            root.innerHTML = `<div class="card"><p class="muted">리뷰 로딩 실패: ${escapeHtml(translateError(rErr))}</p></div>`;
            return;
        }

        // 프로필 정보 가져오기 (핸들)
        const { data: profileInfo } = await state.supabase
            .from('profiles')
            .select('handle')
            .eq('user_id', userId)
            .maybeSingle();
        
        // 이메일 정보는 user_profiles_view에서 가져오기
        let userEmail = null;
        try {
            const { data: emailData } = await state.supabase
                .from('user_profiles_view')
                .select('email')
                .eq('user_id', userId)
                .maybeSingle();
            userEmail = emailData?.email || null;
        } catch(_) {}

        const handle = profileInfo?.handle || userEmail || userId.slice(0, 8);
        const avg = profile?.avg_rating ? Number(profile.avg_rating).toFixed(1) : '-';
        const isOwnProfile = state.session && state.session.user.id === userId;

        root.innerHTML = `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <h3 style="margin:0">${escapeHtml(handle)}의 프로필</h3>
            ${state.session && !isOwnProfile ? `<button class="btn" id="reportUserProfile" style="height:32px;padding:6px 12px;font-size:13px">신고</button>` : ''}
          </div>
          <div class="row" style="gap:10px">
            ${userEmail ? `<span class="chip">${escapeHtml(userEmail)}</span>` : ''}
            <span class="chip"><span class="rating">★</span> ${avg}</span>
            ${isOwnProfile ? '<span class="chip" style="background:var(--primary);color:#0b1020">내 프로필</span>' : ''}
          </div>
        </div>
        ${state.session && !isOwnProfile ? `
        <div class="spacer"></div>
        <div class="card">
          <h3>리뷰 남기기</h3>
          <p class="muted">이 사용자에게 리뷰를 남길 수 있습니다.</p>
          <div class="row" style="justify-content:flex-end">
            <button class="btn btn-primary" id="openReviewForUser">리뷰 작성</button>
          </div>
        </div>
        ` : ''}
        <div class="spacer"></div>
        <div class="card">
          <h3>받은 리뷰</h3>
          <div class="list">${(reviews || []).map(renderReviewItem).join('') || '<p class="muted">아직 리뷰가 없습니다.</p>'}</div>
        </div>
        <div class="spacer"></div>
        <div class="row" style="justify-content:flex-end">
          <button class="btn" id="backToSearch">검색으로 돌아가기</button>
        </div>
      `;

        function renderReviewItem(rv) {
            return `
          <div class="list-item">
            <div>
              <div><span class="rating">★</span> ${Number(rv.rating).toFixed(1)} · <span class="muted">by ${escapeHtml(rv.reviewer_email || rv.reviewer_user_id)}</span></div>
              <div class="muted">${escapeHtml(rv.comment || '')}</div>
            </div>
            <div class="muted" style="font-size:12px">${new Date(rv.created_at).toLocaleString()}</div>
          </div>
        `;
        }

        if (!isOwnProfile && state.session) {
            const openReviewBtn = document.getElementById('openReviewForUser');
            if (openReviewBtn) {
                openReviewBtn.addEventListener('click', () => {
                    openReviewDialog(userId);
                });
            }
            
            const reportBtn = document.getElementById('reportUserProfile');
            if (reportBtn) {
                reportBtn.addEventListener('click', () => {
                    const target = handle || userId;
                    state.pendingReportTarget = target;
                    navigateTo('#/report');
                });
            }
        }

        const backBtn = document.getElementById('backToSearch');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                navigateTo('#/search');
            });
        }
    } catch (err) {
        root.innerHTML = `<div class="card"><h3>오류</h3><p class="muted">${escapeHtml(translateError(err))}</p></div>`;
    }
}

// 프로필 (본인 평균 평점, 받은 리뷰)
async function renderProfile(root) {
    if (!state.session) {
        root.innerHTML = `<div class="card"><h3>로그인이 필요합니다</h3><p class="muted">프로필 페이지는 로그인 후 이용할 수 있어요.</p></div>`;
        return;
    }
    const userId = state.session.user.id;
    const { data: profile, error: pErr } = await state.supabase
        .from('user_profiles_view')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
    if (pErr) {
        root.innerHTML = `<div class="card"><p class="muted">프로필 로딩 실패: ${escapeHtml(translateError(pErr))}</p></div>`;
        return;
    }

    const { data: reviews, error: rErr } = await state.supabase
        .from('reviews_view')
        .select('*')
        .eq('reviewed_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
    if (rErr) {
        root.innerHTML = `<div class="card"><p class="muted">리뷰 로딩 실패: ${escapeHtml(translateError(rErr))}</p></div>`;
        return;
    }

    const avg = profile?.avg_rating ? Number(profile.avg_rating).toFixed(1) : '-';
    root.innerHTML = `
    <section class="grid cols-2">
      <div class="card">
        <h3>내 프로필</h3>
        <div class="row" style="gap:10px">
          <span class="chip">${escapeHtml(state.session.user.email)}</span>
          <span class="chip"><span class="rating">★</span> ${avg}</span>
        </div>
      </div>
      <div class="card">
        <h3>리뷰 남기기</h3>
        <p class="muted">사용자 ID로 리뷰를 남길 수 있습니다.</p>
        <div class="row" style="gap:8px">
          <input id="reviewTarget" placeholder="리뷰 대상 사용자 ID" style="flex:1" />
          <button class="btn" id="openReview">리뷰 작성</button>
        </div>
      </div>
    </section>
    <div class="spacer"></div>
    <div class="card">
      <h3>받은 리뷰</h3>
      <div class="list">${(reviews || []).map(renderReviewItem).join('') || '<p class="muted">아직 리뷰가 없습니다.</p>'}</div>
    </div>
  `;

    document.getElementById('openReview').addEventListener('click', () => {
        const id = document.getElementById('reviewTarget').value.trim();
        if (!id) return;
        openReviewDialog(id);
    });

    function renderReviewItem(rv) {
        return `
      <div class="list-item">
        <div>
          <div><span class="rating">★</span> ${Number(rv.rating).toFixed(1)} · <span class="muted">by ${escapeHtml(rv.reviewer_email || rv.reviewer_user_id)}</span></div>
          <div class="muted">${escapeHtml(rv.comment || '')}</div>
        </div>
        <div class="muted" style="font-size:12px">${new Date(rv.created_at).toLocaleString()}</div>
      </div>
    `;
    }
}

// 고객센터 (티켓 생성)
async function renderCustomer(root) {
    if (!state.session) {
        root.innerHTML = `<div class="card"><h3>로그인이 필요합니다</h3><p class="muted">고객센터 문의는 로그인 후 이용할 수 있어요.</p></div>`;
        return;
    }
    root.innerHTML = `
    <div class="card">
      <h3>고객센터 문의</h3>
      <div class="grid">
        <div class="field">
          <label>이메일</label>
          <input id="ticketEmail" placeholder="답변 받을 이메일" value="${state.session?.user?.email || ''}">
        </div>
        <div class="field">
          <label>제목</label>
          <input id="ticketTitle" placeholder="문의 제목">
        </div>
        <div class="field">
          <label>내용</label>
          <textarea id="ticketBody" placeholder="자세한 내용을 적어주세요"></textarea>
        </div>
        <div class="row" style="justify-content:flex-end">
          <button class="btn btn-primary" id="submitTicket">문의 보내기</button>
        </div>
      </div>
    </div>
  `;

    document.getElementById('submitTicket').addEventListener('click', async () => {
        if (!state.session) { alert('로그인이 필요합니다'); return; }
        const email = document.getElementById('ticketEmail').value.trim();
        const title = document.getElementById('ticketTitle').value.trim();
        const body = document.getElementById('ticketBody').value.trim();
        if (!email || !title || !body) return alert('모든 항목을 입력하세요.');
        const { error } = await state.supabase.from('tickets').insert({ email, title, body });
        if (error) return alert('등록 실패: ' + translateError(error));
        alert('문의가 접수되었습니다.');
        navigateTo('#/');
    });
}

// 관리자 페이지
async function renderAdmin(root) {
    if (!state.session) {
        root.innerHTML = `<div class="card"><h3>로그인이 필요합니다</h3><p class="muted">관리자 페이지는 로그인 후 이용할 수 있어요.</p></div>`;
        return;
    }
    
    if (!state.isAdmin) {
        root.innerHTML = `<div class="card"><h3>권한이 없습니다</h3><p class="muted">관리자만 접근할 수 있는 페이지입니다.</p></div>`;
        return;
    }

    root.innerHTML = `
    <div class="card">
      <h3>👑 관리자 페이지</h3>
      <p class="muted">모든 의뢰, 댓글, 고객센터 문의, 신고를 관리할 수 있습니다.</p>
    </div>
    <div class="spacer"></div>
    <div class="card">
      <h3>전체 의뢰 목록</h3>
      <div class="list" id="adminRequestsList"></div>
    </div>
    <div class="spacer"></div>
    <div class="card">
      <h3>전체 댓글 관리</h3>
      <div class="list" id="adminCommentsList"></div>
    </div>
    <div class="spacer"></div>
    <div class="card">
      <h3>고객센터 문의</h3>
      <div class="list" id="adminTicketsList"></div>
    </div>
    <div class="spacer"></div>
    <div class="card">
      <h3>신고 내역</h3>
      <div class="list" id="adminReportsList"></div>
    </div>
  `;

    await loadAdminRequests();
    await loadAdminComments();
    await loadAdminTickets();
    await loadAdminReports();

    async function loadAdminRequests() {
        const { data: requests, error } = await state.supabase
            .from('requests_view')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        const list = document.getElementById('adminRequestsList');
        if (error) {
            list.innerHTML = `<p class="muted">의뢰 로딩 실패: ${escapeHtml(translateError(error))}</p>`;
            return;
        }

        if (!requests || requests.length === 0) {
            list.innerHTML = '<p class="muted">의뢰가 없습니다.</p>';
            return;
        }

        // 작성자 핸들 조회
        let handlesByUserId = {};
        try {
            const ids = Array.from(new Set(requests.map((d) => d.owner_user_id))).filter(Boolean);
            if (ids.length) {
                const { data: profs } = await state.supabase.from('profiles').select('user_id, handle').in('user_id', ids);
                (profs || []).forEach(p => { if (p.handle) handlesByUserId[p.user_id] = p.handle; });
            }
        } catch(_) {}

        list.innerHTML = requests.map(item => {
            const rating = item.avg_rating ? Number(item.avg_rating).toFixed(1) : '-';
            const handle = handlesByUserId?.[item.owner_user_id] || (item.owner_user_id ? item.owner_user_id.slice(0,8) : '-');
            const date = new Date(item.created_at).toLocaleString('ko-KR', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
                <div class="list-item">
                    <div>
                        <h4 style="margin:0 0 4px">${escapeHtml(item.title)}</h4>
                        <div class="muted" style="margin-bottom:6px">${escapeHtml(item.summary || '')}</div>
                        <div class="row" style="gap:8px;margin-bottom:4px">
                            <span class="chip">${escapeHtml(item.category || '기타')}</span>
                            <span class="chip"><span class="rating">★</span> ${rating}</span>
                            <span class="chip">작성자: ${escapeHtml(handle)}</span>
                            <span class="chip muted" style="font-size:11px">${date}</span>
                        </div>
                    </div>
                    <div class="row">
                        <button class="btn btn-danger" data-admin-action="delete-request" data-id="${item.id}" data-title="${escapeHtml(item.title)}">의뢰 삭제</button>
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('[data-admin-action="delete-request"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const title = e.target.getAttribute('data-title');
                if (!confirm(`정말 "${title}" 의뢰를 삭제하시겠습니까?\n\n(관리자 권한으로 삭제됩니다.)`)) return;

                // 버튼 비활성화 및 로딩 표시
                const originalText = e.target.textContent;
                e.target.disabled = true;
                e.target.textContent = '삭제 중...';

                const { error, data } = await state.supabase
                    .from('requests')
                    .delete()
                    .eq('id', id)
                    .select();

                e.target.disabled = false;
                e.target.textContent = originalText;

                if (error) {
                    const errorMsg = translateError(error);
                    const fullError = error.message || String(error);
                    console.error('관리자 의뢰 삭제 오류:', error);
                    
                    if (fullError.includes('permission denied') || fullError.includes('policy') || fullError.includes('RLS')) {
                        alert(`삭제 권한이 없습니다.\n\nRLS 정책을 확인해주세요.\n\nSupabase SQL Editor에서 다음을 실행하세요:\n\n-- 기존 정책이 있으면 삭제 후 재생성\nDROP POLICY IF EXISTS "Admins can delete any request" ON requests;\n\nCREATE POLICY "Admins can delete any request" ON requests\n  FOR DELETE USING (\n    auth.jwt() ->> 'email' IN ('wjekzzz@gmail.com')\n  );`);
                    } else {
                        alert(`삭제 실패: ${errorMsg}\n\n상세 오류:\n${fullError}\n\n콘솔에서 더 자세한 정보를 확인할 수 있습니다.`);
                    }
                    return;
                }

                alert('의뢰가 삭제되었습니다.');
                await loadAdminRequests();
            });
        });
    }

    async function loadAdminComments() {
        const { data: comments, error } = await state.supabase
            .from('request_comments')
            .select('*, requests(title)')
            .order('created_at', { ascending: false })
            .limit(100);

        const list = document.getElementById('adminCommentsList');
        if (error) {
            list.innerHTML = `<p class="muted">댓글 로딩 실패: ${escapeHtml(translateError(error))}</p>`;
            return;
        }

        if (!comments || comments.length === 0) {
            list.innerHTML = '<p class="muted">댓글이 없습니다.</p>';
            return;
        }

        // 작성자 정보 조회
        const userIds = [...new Set(comments.map(c => c.user_id).filter(Boolean))];
        let handlesByUserId = {};
        if (userIds.length > 0) {
            try {
                const { data: profs } = await state.supabase
                    .from('profiles')
                    .select('user_id, handle')
                    .in('user_id', userIds);
                (profs || []).forEach(p => {
                    if (p.handle) handlesByUserId[p.user_id] = p.handle;
                });
            } catch(_) {}
        }

        list.innerHTML = comments.map(comment => {
            const date = new Date(comment.created_at).toLocaleString('ko-KR', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            const authorName = handlesByUserId[comment.user_id] || comment.user_id?.slice(0,8) || '익명';
            const requestTitle = comment.requests?.title || '알 수 없는 의뢰';

            return `
                <div class="list-item">
                    <div style="flex:1">
                        <div style="margin-bottom:4px">
                            <strong>${escapeHtml(authorName)}</strong>
                            <span class="muted" style="font-size:12px"> · ${date}</span>
                        </div>
                        <div class="muted" style="font-size:12px;margin-bottom:4px">
                            의뢰: ${escapeHtml(requestTitle)}
                        </div>
                        <div>${escapeHtml(comment.comment)}</div>
                    </div>
                    <button class="btn btn-danger" data-admin-action="delete-comment" data-id="${comment.id}">댓글 삭제</button>
                </div>
            `;
        }).join('');

        list.querySelectorAll('[data-admin-action="delete-comment"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                if (!confirm('정말 이 댓글을 삭제하시겠습니까?\n\n(관리자 권한으로 삭제됩니다.)')) return;

                // 버튼 비활성화 및 로딩 표시
                const originalText = e.target.textContent;
                e.target.disabled = true;
                e.target.textContent = '삭제 중...';

                const { error, data } = await state.supabase
                    .from('request_comments')
                    .delete()
                    .eq('id', id)
                    .select();

                e.target.disabled = false;
                e.target.textContent = originalText;

                if (error) {
                    const errorMsg = translateError(error);
                    const fullError = error.message || String(error);
                    console.error('관리자 댓글 삭제 오류:', error);
                    
                    if (fullError.includes('permission denied') || fullError.includes('policy') || fullError.includes('RLS')) {
                        alert(`삭제 권한이 없습니다.\n\nRLS 정책을 확인해주세요.\n\nSupabase SQL Editor에서 다음을 실행하세요:\n\n-- 기존 정책이 있으면 삭제 후 재생성\nDROP POLICY IF EXISTS "Admins can delete any comment" ON request_comments;\n\nCREATE POLICY "Admins can delete any comment" ON request_comments\n  FOR DELETE USING (\n    auth.jwt() ->> 'email' IN ('wjekzzz@gmail.com')\n  );`);
                    } else {
                        alert(`삭제 실패: ${errorMsg}\n\n상세 오류:\n${fullError}\n\n콘솔에서 더 자세한 정보를 확인할 수 있습니다.`);
                    }
                    return;
                }

                alert('댓글이 삭제되었습니다.');
                await loadAdminComments();
            });
        });
    }

    async function loadAdminTickets() {
        const { data: tickets, error } = await state.supabase
            .from('tickets')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        const list = document.getElementById('adminTicketsList');
        if (error) {
            const errorMsg = translateError(error);
            const fullError = error.message || String(error);
            console.error('고객센터 문의 로딩 오류:', error);
            
            if (fullError.includes('permission denied') || fullError.includes('policy') || fullError.includes('RLS')) {
                list.innerHTML = `
                    <div class="card" style="padding:20px;text-align:center">
                        <p class="muted" style="margin-bottom:12px;color:var(--warn)">⚠️ 권한이 없습니다</p>
                        <p class="muted" style="font-size:12px;margin-bottom:8px">관리자가 tickets 테이블을 조회하려면 RLS 정책이 필요합니다.</p>
                        <details style="margin-top:12px;text-align:left">
                            <summary style="cursor:pointer;color:var(--primary);font-size:12px">RLS 정책 설정 SQL 보기</summary>
                            <pre style="background:#0c111a;padding:12px;border-radius:8px;overflow-x:auto;text-align:left;font-size:11px;margin-top:8px">
-- 관리자가 모든 tickets 조회 가능
CREATE POLICY "Admins can view all tickets" ON tickets
  FOR SELECT USING (
    auth.jwt() ->> 'email' IN ('wjekzzz@gmail.com')
  );</pre>
                        </details>
                        <p class="muted" style="font-size:11px;margin-top:12px">오류 상세: ${escapeHtml(fullError)}</p>
                    </div>
                `;
            } else if (fullError.includes('schema cache') || fullError.includes('Could not find')) {
                list.innerHTML = `
                    <div class="card" style="padding:20px;text-align:center">
                        <p class="muted" style="margin-bottom:12px;color:var(--warn)">⚠️ tickets 테이블을 찾을 수 없습니다</p>
                        <p class="muted" style="font-size:12px;margin-bottom:8px">Supabase에서 tickets 테이블이 생성되었는지 확인해주세요.</p>
                        <details style="margin-top:12px;text-align:left">
                            <summary style="cursor:pointer;color:var(--primary);font-size:12px">테이블 생성 SQL 보기</summary>
                            <pre style="background:#0c111a;padding:12px;border-radius:8px;overflow-x:auto;text-align:left;font-size:11px;margin-top:8px">
CREATE TABLE tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 tickets 삽입 가능
CREATE POLICY "Anyone can insert tickets" ON tickets
  FOR INSERT WITH CHECK (true);

-- 관리자가 모든 tickets 조회 가능
CREATE POLICY "Admins can view all tickets" ON tickets
  FOR SELECT USING (
    auth.jwt() ->> 'email' IN ('wjekzzz@gmail.com')
  );</pre>
                        </details>
                    </div>
                `;
            } else {
                list.innerHTML = `<p class="muted">고객센터 문의 로딩 실패: ${escapeHtml(errorMsg)}</p><p class="muted" style="font-size:11px;margin-top:8px">${escapeHtml(fullError)}</p>`;
            }
            return;
        }

        if (!tickets || tickets.length === 0) {
            list.innerHTML = '<p class="muted">고객센터 문의가 없습니다.</p>';
            return;
        }

        list.innerHTML = tickets.map(ticket => {
            const date = new Date(ticket.created_at).toLocaleString('ko-KR', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
                <div class="list-item">
                    <div style="flex:1">
                        <div style="margin-bottom:4px">
                            <strong>${escapeHtml(ticket.title || '제목 없음')}</strong>
                            <span class="muted" style="font-size:12px"> · ${date}</span>
                        </div>
                        <div class="muted" style="font-size:12px;margin-bottom:4px">
                            이메일: ${escapeHtml(ticket.email || '없음')}
                        </div>
                        <div style="white-space:pre-wrap;word-break:break-word">${escapeHtml(ticket.body || '내용 없음')}</div>
                    </div>
                    <button class="btn btn-danger" data-admin-action="delete-ticket" data-id="${ticket.id}">문의 삭제</button>
                </div>
            `;
        }).join('');

        list.querySelectorAll('[data-admin-action="delete-ticket"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                if (!confirm('정말 이 고객센터 문의를 삭제하시겠습니까?\n\n(관리자 권한으로 삭제됩니다.)')) return;

                const originalText = e.target.textContent;
                e.target.disabled = true;
                e.target.textContent = '삭제 중...';

                const { error, data } = await state.supabase
                    .from('tickets')
                    .delete()
                    .eq('id', id)
                    .select();

                e.target.disabled = false;
                e.target.textContent = originalText;

                if (error) {
                    const errorMsg = translateError(error);
                    const fullError = error.message || String(error);
                    console.error('고객센터 문의 삭제 오류:', error);
                    
                    if (fullError.includes('permission denied') || fullError.includes('policy') || fullError.includes('RLS')) {
                        alert(`삭제 권한이 없습니다.\n\nRLS 정책을 확인해주세요.\n\nSupabase SQL Editor에서 다음을 실행하세요:\n\n-- 기존 정책이 있으면 삭제 후 재생성\nDROP POLICY IF EXISTS "Admins can delete any ticket" ON tickets;\n\nCREATE POLICY "Admins can delete any ticket" ON tickets\n  FOR DELETE USING (\n    auth.jwt() ->> 'email' IN ('wjekzzz@gmail.com')\n  );`);
                    } else {
                        alert(`삭제 실패: ${errorMsg}\n\n상세 오류:\n${fullError}\n\n콘솔에서 더 자세한 정보를 확인할 수 있습니다.`);
                    }
                    return;
                }

                alert('고객센터 문의가 삭제되었습니다.');
                await loadAdminTickets();
            });
        });
    }

    async function loadAdminReports() {
        const { data: reports, error } = await state.supabase
            .from('reports')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        const list = document.getElementById('adminReportsList');
        if (error) {
            const errorMsg = translateError(error);
            const fullError = error.message || String(error);
            console.error('신고 로딩 오류:', error);
            
            if (fullError.includes('permission denied') || fullError.includes('policy') || fullError.includes('RLS')) {
                list.innerHTML = `
                    <div class="card" style="padding:20px;text-align:center">
                        <p class="muted" style="margin-bottom:12px;color:var(--warn)">⚠️ 권한이 없습니다</p>
                        <p class="muted" style="font-size:12px;margin-bottom:8px">관리자가 reports 테이블을 조회하려면 RLS 정책이 필요합니다.</p>
                        <details style="margin-top:12px;text-align:left">
                            <summary style="cursor:pointer;color:var(--primary);font-size:12px">RLS 정책 설정 SQL 보기</summary>
                            <pre style="background:#0c111a;padding:12px;border-radius:8px;overflow-x:auto;text-align:left;font-size:11px;margin-top:8px">
-- 관리자가 모든 reports 조회 가능
CREATE POLICY "Admins can view all reports" ON reports
  FOR SELECT USING (
    auth.jwt() ->> 'email' IN ('wjekzzz@gmail.com')
  );</pre>
                        </details>
                        <p class="muted" style="font-size:11px;margin-top:12px">오류 상세: ${escapeHtml(fullError)}</p>
                    </div>
                `;
            } else if (fullError.includes('schema cache') || fullError.includes('Could not find')) {
                list.innerHTML = `
                    <div class="card" style="padding:20px;text-align:center">
                        <p class="muted" style="margin-bottom:12px;color:var(--warn)">⚠️ reports 테이블을 찾을 수 없습니다</p>
                        <p class="muted" style="font-size:12px;margin-bottom:8px">Supabase에서 reports 테이블이 생성되었는지 확인해주세요.</p>
                        <details style="margin-top:12px;text-align:left">
                            <summary style="cursor:pointer;color:var(--primary);font-size:12px">테이블 생성 SQL 보기</summary>
                            <pre style="background:#0c111a;padding:12px;border-radius:8px;overflow-x:auto;text-align:left;font-size:11px;margin-top:8px">
CREATE TABLE reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  target TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 reports 삽입 가능
CREATE POLICY "Anyone can insert reports" ON reports
  FOR INSERT WITH CHECK (true);

-- 관리자가 모든 reports 조회 가능
CREATE POLICY "Admins can view all reports" ON reports
  FOR SELECT USING (
    auth.jwt() ->> 'email' IN ('wjekzzz@gmail.com')
  );</pre>
                        </details>
                    </div>
                `;
            } else {
                list.innerHTML = `<p class="muted">신고 로딩 실패: ${escapeHtml(errorMsg)}</p><p class="muted" style="font-size:11px;margin-top:8px">${escapeHtml(fullError)}</p>`;
            }
            return;
        }

        if (!reports || reports.length === 0) {
            list.innerHTML = '<p class="muted">신고 내역이 없습니다.</p>';
            return;
        }

        list.innerHTML = reports.map(report => {
            const date = new Date(report.created_at).toLocaleString('ko-KR', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
                <div class="list-item">
                    <div style="flex:1">
                        <div style="margin-bottom:4px">
                            <strong>대상: ${escapeHtml(report.target || '없음')}</strong>
                            <span class="muted" style="font-size:12px"> · ${date}</span>
                        </div>
                        <div style="white-space:pre-wrap;word-break:break-word">${escapeHtml(report.reason || '사유 없음')}</div>
                    </div>
                    <button class="btn btn-danger" data-admin-action="delete-report" data-id="${report.id}">신고 삭제</button>
                </div>
            `;
        }).join('');

        list.querySelectorAll('[data-admin-action="delete-report"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                if (!confirm('정말 이 신고 내역을 삭제하시겠습니까?\n\n(관리자 권한으로 삭제됩니다.)')) return;

                const originalText = e.target.textContent;
                e.target.disabled = true;
                e.target.textContent = '삭제 중...';

                const { error, data } = await state.supabase
                    .from('reports')
                    .delete()
                    .eq('id', id)
                    .select();

                e.target.disabled = false;
                e.target.textContent = originalText;

                if (error) {
                    const errorMsg = translateError(error);
                    const fullError = error.message || String(error);
                    console.error('신고 삭제 오류:', error);
                    
                    if (fullError.includes('permission denied') || fullError.includes('policy') || fullError.includes('RLS')) {
                        alert(`삭제 권한이 없습니다.\n\nRLS 정책을 확인해주세요.\n\nSupabase SQL Editor에서 다음을 실행하세요:\n\n-- 기존 정책이 있으면 삭제 후 재생성\nDROP POLICY IF EXISTS "Admins can delete any report" ON reports;\n\nCREATE POLICY "Admins can delete any report" ON reports\n  FOR DELETE USING (\n    auth.jwt() ->> 'email' IN ('wjekzzz@gmail.com')\n  );`);
                    } else {
                        alert(`삭제 실패: ${errorMsg}\n\n상세 오류:\n${fullError}\n\n콘솔에서 더 자세한 정보를 확인할 수 있습니다.`);
                    }
                    return;
                }

                alert('신고 내역이 삭제되었습니다.');
                await loadAdminReports();
            });
        });
    }
}

// 신고 (간단)
async function renderReport(root) {
    if (!state.session) {
        root.innerHTML = `<div class="card"><h3>로그인이 필요합니다</h3><p class="muted">신고 기능은 로그인 후 이용할 수 있어요.</p></div>`;
        return;
    }
    root.innerHTML = `
    <div class="card">
      <h3>신고하기</h3>
      <div class="grid">
        <div class="field">
          <label>대상 ID (사용자 또는 의뢰)</label>
          <input id="reportTarget" placeholder="예: user_abc 또는 req_123">
        </div>
        <div class="field">
          <label>사유</label>
          <textarea id="reportReason" placeholder="간단한 신고 사유"></textarea>
        </div>
        <div class="row" style="justify-content:flex-end">
          <button class="btn btn-primary" id="submitReport">신고 제출</button>
        </div>
      </div>
    </div>
  `;

    // 작성자 신고 버튼에서 넘어온 값 채우기
    if (state.pendingReportTarget) {
        const input = document.getElementById('reportTarget');
        input.value = state.pendingReportTarget;
        state.pendingReportTarget = null;
    }

    document.getElementById('submitReport').addEventListener('click', async () => {
        if (!state.session) { alert('로그인이 필요합니다'); return; }
        const target = document.getElementById('reportTarget').value.trim();
        const reason = document.getElementById('reportReason').value.trim();
        if (!target || !reason) return alert('모든 항목을 입력하세요.');
        const { error } = await state.supabase.from('reports').insert({ target, reason });
        if (error) return alert('제출 실패: ' + translateError(error));
        alert('신고가 접수되었습니다. 감사합니다.');
        navigateTo('#/');
    });
}

// 1:1 메시지 대화 다이얼로그
async function openMessagesDialog(receiverId, receiverHandle, requestId, requestTitle) {
    if (!state.session) {
        alert('로그인이 필요합니다');
        return;
    }
    
    const senderId = state.session.user.id;
    
    // 현재 열려있는 메시지 다이얼로그 정보 저장 (알림 방지용)
    state.activeMessageDialog = { requestId, receiverId, senderId };
    
    const messagesViewDialog = document.getElementById('messagesViewDialog');
    const messagesViewTitle = document.getElementById('messagesViewTitle');
    const messagesViewClose = document.getElementById('messagesViewClose');
    const messagesList = document.getElementById('messagesList');
    const messageFormSection = document.getElementById('messageFormSection');

    messagesViewTitle.textContent = `"${escapeHtml(requestTitle)}" - ${escapeHtml(receiverHandle)}님과의 메시지`;
    messagesList.innerHTML = '<p class="muted" style="text-align:center;padding:20px">로딩 중...</p>';

    // 메시지 작성 폼
    messageFormSection.innerHTML = `
        <div class="comment-form-section">
            <textarea id="newMessageText" placeholder="메시지를 입력하세요..." style="width:100%;min-height:80px;resize:vertical;margin-bottom:8px;background:#0c111a;border:1px solid var(--border);border-radius:8px;color:var(--text);padding:10px;box-sizing:border-box"></textarea>
            <div style="display:flex;justify-content:flex-end;gap:8px">
                <button type="button" class="btn btn-primary" id="submitMessage">전송</button>
            </div>
        </div>
    `;

    // 닫기 버튼 이벤트
    const closeBtnHandler = () => messagesViewDialog.close();
    messagesViewClose.replaceWith(messagesViewClose.cloneNode(true));
    const newCloseBtn = document.getElementById('messagesViewClose');
    newCloseBtn.addEventListener('click', closeBtnHandler);

    // 메시지 전송 이벤트
    const newMessageText = document.getElementById('newMessageText');
    const submitMessage = document.getElementById('submitMessage');
    if (submitMessage && newMessageText) {
        const submitHandler = async () => {
            const text = newMessageText.value.trim();
            if (!text) {
                alert('메시지 내용을 입력해주세요.');
                return;
            }

            submitMessage.disabled = true;
            submitMessage.textContent = '전송 중...';

            const { error } = await state.supabase.from('messages').insert({
                sender_id: senderId,
                receiver_id: receiverId,
                message: text,
                request_id: requestId, // 관련 의뢰 ID (필수)
            });

            submitMessage.disabled = false;
            submitMessage.textContent = '전송';

            if (error) {
                const errorMsg = translateError(error);
                const fullError = error.message || String(error);
                console.error('메시지 전송 오류:', error);
                
                if (fullError.includes('schema cache') || fullError.includes('does not exist') || fullError.includes('Could not find')) {
                    alert(`메시지 테이블을 찾을 수 없습니다.\n\nSupabase SQL Editor에서 messages 테이블을 생성해야 합니다.\n\n생성 SQL:\n\nCREATE TABLE IF NOT EXISTS messages (\n  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n  sender_id UUID NOT NULL,\n  receiver_id UUID NOT NULL,\n  message TEXT NOT NULL,\n  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,\n  created_at TIMESTAMPTZ DEFAULT NOW(),\n  read_at TIMESTAMPTZ\n);\n\nCREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);\nCREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);\nCREATE INDEX IF NOT EXISTS idx_messages_request ON messages(request_id);\n\nALTER TABLE messages ENABLE ROW LEVEL SECURITY;\n\n-- RLS 정책\nDROP POLICY IF EXISTS "Users can view own messages" ON messages;\nDROP POLICY IF EXISTS "Users can send messages" ON messages;\n\nCREATE POLICY "Users can view own messages" ON messages\n  FOR SELECT USING (\n    (sender_id = auth.uid() OR receiver_id = auth.uid())\n  );\n\nCREATE POLICY "Users can send messages" ON messages\n  FOR INSERT WITH CHECK (\n    auth.role() = 'authenticated' AND sender_id = auth.uid()\n  );`);
                } else {
                    alert('메시지 전송 실패: ' + errorMsg + '\n\n상세: ' + fullError);
                }
                return;
            }

            // 메시지 목록 새로고침
            await loadMessages();
            
            // 입력란 초기화
            const updatedTextArea = document.getElementById('newMessageText');
            if (updatedTextArea) updatedTextArea.value = '';
        };

        submitMessage.addEventListener('click', submitHandler);
        
        // Enter 키로 전송 (Shift+Enter는 줄바꿈)
        newMessageText.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitHandler();
            }
        });
    }

    messagesViewDialog.showModal();

    // 메시지 로드
    await loadMessages();

    async function loadMessages() {
        try {
            // 이 의뢰(request_id)에 대한 메시지만 가져오기
            const { data: messages, error } = await state.supabase
                .from('messages')
                .select('*')
                .eq('request_id', requestId)
                .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`)
                .order('created_at', { ascending: true });

            if (error) {
                const fullError = error.message || String(error);
                if (fullError.includes('schema cache') || fullError.includes('does not exist') || fullError.includes('Could not find')) {
                    messagesList.innerHTML = `
                        <div class="card" style="padding:20px;text-align:center">
                            <p class="muted" style="margin-bottom:12px;color:var(--warn)">⚠️ 메시지 테이블을 찾을 수 없습니다</p>
                            <p class="muted" style="font-size:12px;margin-bottom:8px">Supabase SQL Editor에서 messages 테이블을 생성해주세요.</p>
                            <details style="margin-top:12px;text-align:left">
                                <summary style="cursor:pointer;color:var(--primary);font-size:12px">생성 SQL 보기</summary>
                                <pre style="background:#0c111a;padding:12px;border-radius:8px;overflow-x:auto;text-align:left;font-size:11px;margin-top:8px;white-space:pre-wrap">CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  message TEXT NOT NULL,
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_request ON messages(request_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS 정책
DROP POLICY IF EXISTS "Users can view own messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;

CREATE POLICY "Users can view own messages" ON messages
  FOR SELECT USING (
    (sender_id = auth.uid() OR receiver_id = auth.uid())
  );

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND sender_id = auth.uid()
  );</pre>
                            </details>
                            <p class="muted" style="font-size:11px;margin-top:12px">오류: ${escapeHtml(fullError)}</p>
                        </div>
                    `;
                } else {
                    messagesList.innerHTML = `<div class="card"><p class="muted">메시지 로딩 실패: ${escapeHtml(translateError(error))}</p></div>`;
                }
                return;
            }

            // 이미 request_id로 필터링되어 있지만, 추가 안전장치로 확인
            const conversationMessages = (messages || []).filter(msg => 
                msg.request_id === requestId &&
                ((msg.sender_id === senderId && msg.receiver_id === receiverId) ||
                 (msg.sender_id === receiverId && msg.receiver_id === senderId))
            );

            if (!conversationMessages || conversationMessages.length === 0) {
                messagesList.innerHTML = '<div style="text-align:center;padding:40px"><p class="muted">아직 메시지가 없습니다.<br>첫 메시지를 보내보세요!</p></div>';
                return;
            }

            // 사용자 정보 조회
            const userIds = [...new Set([
                ...conversationMessages.map(m => m.sender_id),
                ...conversationMessages.map(m => m.receiver_id)
            ].filter(Boolean))];
            let handlesByUserId = {};
            if (userIds.length > 0) {
                try {
                    const { data: profs } = await state.supabase
                        .from('profiles')
                        .select('user_id, handle')
                        .in('user_id', userIds);
                    (profs || []).forEach(p => {
                        if (p.handle) handlesByUserId[p.user_id] = p.handle;
                    });
                } catch(_) {}
            }

            // 메시지 렌더링 (채팅 스타일)
            messagesList.innerHTML = conversationMessages.map(msg => {
                const date = new Date(msg.created_at).toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                const isSent = msg.sender_id === senderId;
                const senderName = handlesByUserId[msg.sender_id] || msg.sender_id?.slice(0,8) || '익명';
                
                return `
                    <div style="display:flex;flex-direction:${isSent ? 'row-reverse' : 'row'};gap:8px;align-items:flex-start;margin-bottom:4px">
                        <div style="flex:1;max-width:70%">
                            <div style="font-size:11px;color:var(--muted);margin-bottom:4px;text-align:${isSent ? 'right' : 'left'}">
                                ${isSent ? '나' : escapeHtml(senderName)} · ${date}
                            </div>
                            <div style="background:${isSent ? 'var(--primary)' : 'var(--card)'};color:${isSent ? '#fff' : 'var(--text)'};padding:10px 14px;border-radius:12px;word-wrap:break-word">
                                ${escapeHtml(msg.message)}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            // 스크롤을 맨 아래로
            messagesList.scrollTop = messagesList.scrollHeight;
        } catch(err) {
            console.error('메시지 로드 오류:', err);
            messagesList.innerHTML = `<div class="card"><p class="muted">오류가 발생했습니다: ${escapeHtml(err.message || String(err))}</p></div>`;
        }
    }
    
    // 주기적으로 메시지 새로고침 (3초마다)
    let refreshInterval = null;
    let isDialogOpen = true;
    
    const startRefresh = () => {
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(async () => {
            if (isDialogOpen) {
                await loadMessages();
            }
        }, 1000); // 1초마다 새로고침
    };
    
    const stopRefresh = () => {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
        isDialogOpen = false;
    };
    
    // 다이얼로그가 닫힐 때 인터벌 정리
    const closeHandler = () => {
        stopRefresh();
        // 메시지 다이얼로그가 닫히면 상태 초기화
        state.activeMessageDialog = null;
    };
    
    messagesViewDialog.addEventListener('close', closeHandler);
    messagesViewDialog.addEventListener('cancel', closeHandler);
    
    // 새로고침 시작
    startRefresh();
}

// 의뢰 작성자가 자신의 의뢰에 대한 메시지 참가자 목록 보기
async function openRequestMessagesDialog(requestId, requestTitle) {
    if (!state.session) {
        alert('로그인이 필요합니다');
        return;
    }
    
    const ownerId = state.session.user.id;
    
    // 이 의뢰에 메시지를 보낸 사람들 목록 가져오기
    try {
        const { data: messages, error } = await state.supabase
            .from('messages')
            .select('sender_id, receiver_id')
            .eq('request_id', requestId)
            .or(`sender_id.eq.${ownerId},receiver_id.eq.${ownerId}`);
        
        if (error) {
            const fullError = error.message || String(error);
            if (fullError.includes('schema cache') || fullError.includes('does not exist') || fullError.includes('Could not find')) {
                alert('메시지 테이블을 찾을 수 없습니다.\n\nSupabase SQL Editor에서 messages 테이블을 생성해주세요.');
            } else {
                alert('메시지 로딩 실패: ' + translateError(error));
            }
            return;
        }
        
        // 메시지를 보낸/받은 모든 사용자 ID 수집
        const participantIds = new Set();
        (messages || []).forEach(msg => {
            if (msg.sender_id !== ownerId) participantIds.add(msg.sender_id);
            if (msg.receiver_id !== ownerId) participantIds.add(msg.receiver_id);
        });
        
        if (participantIds.size === 0) {
            alert('이 의뢰에 대한 메시지가 아직 없습니다.');
            return;
        }
        
        // 사용자 핸들 정보 가져오기
        const userIds = Array.from(participantIds);
        let handlesByUserId = {};
        try {
            const { data: profs } = await state.supabase
                .from('profiles')
                .select('user_id, handle')
                .in('user_id', userIds);
            (profs || []).forEach(p => {
                if (p.handle) handlesByUserId[p.user_id] = p.handle;
            });
        } catch(_) {}
        
        // 메시지 참가자 선택 다이얼로그
        const participantList = userIds.map(userId => {
            const handle = handlesByUserId[userId] || userId.slice(0,8) || '익명';
            return `<button class="btn" style="width:100%;margin-bottom:8px;text-align:left" data-participant-id="${userId}" data-participant-handle="${escapeHtml(handle)}">${escapeHtml(handle)}님과의 메시지</button>`;
        }).join('');
        
        const choice = await new Promise((resolve) => {
            const dialog = document.createElement('dialog');
            dialog.style.cssText = 'max-width:400px;padding:20px;background:var(--background);border:1px solid var(--border);border-radius:12px';
            dialog.innerHTML = `
                <div>
                    <h3 style="margin:0 0 16px">"${escapeHtml(requestTitle)}" 메시지 참가자</h3>
                    <div style="margin-bottom:16px">
                        ${participantList}
                    </div>
                    <div style="display:flex;justify-content:flex-end">
                        <button class="btn" id="closeParticipantDialog">닫기</button>
                    </div>
                </div>
            `;
            document.body.appendChild(dialog);
            dialog.showModal();
            
            dialog.querySelectorAll('[data-participant-id]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const participantId = btn.getAttribute('data-participant-id');
                    const participantHandle = btn.getAttribute('data-participant-handle');
                    document.body.removeChild(dialog);
                    resolve({ userId: participantId, handle: participantHandle });
                });
            });
            
            dialog.querySelector('#closeParticipantDialog').addEventListener('click', () => {
                document.body.removeChild(dialog);
                resolve(null);
            });
        });
        
        if (choice) {
            openMessagesDialog(choice.userId, choice.handle, requestId, requestTitle);
        }
    } catch(err) {
        console.error('메시지 참가자 목록 로딩 오류:', err);
        alert('오류가 발생했습니다: ' + (err.message || String(err)));
    }
}

// 댓글 관련 함수 제거 (레거시)
async function openCommentsViewDialog(requestId, requestTitle) {
    const commentsViewDialog = document.getElementById('commentsViewDialog');
    const commentsViewTitle = document.getElementById('commentsViewTitle');
    const commentsViewClose = document.getElementById('commentsViewClose');
    const commentsList = document.getElementById('commentsList');

    commentsViewTitle.textContent = `"${escapeHtml(requestTitle)}" 댓글`;
    commentsList.innerHTML = '<p class="muted" style="text-align:center;padding:20px">로딩 중...</p>';

    // 댓글 작성 폼 표시/숨김
    const commentFormSection = document.getElementById('commentFormSection');
    if (state.session) {
        commentFormSection.innerHTML = `
            <div class="comment-form-section">
                <textarea id="newCommentText" placeholder="댓글을 작성하세요..." style="width:100%;min-height:80px;resize:vertical;margin-bottom:8px;background:#0c111a;border:1px solid var(--border);border-radius:8px;color:var(--text);padding:10px;box-sizing:border-box"></textarea>
                <div style="display:flex;justify-content:flex-end;gap:8px">
                    <button type="button" class="btn btn-primary" id="submitComment">댓글 등록</button>
                </div>
            </div>
        `;
    } else {
        commentFormSection.innerHTML = '<p class="muted" style="text-align:center;padding:12px">댓글을 작성하려면 로그인이 필요합니다.</p>';
    }

    // 기존 이벤트 리스너 제거 후 새로 추가
    const closeHandler = () => commentsViewDialog.close();
    commentsViewClose.replaceWith(commentsViewClose.cloneNode(true));
    const newCloseBtn = document.getElementById('commentsViewClose');
    newCloseBtn.addEventListener('click', closeHandler);

    // 댓글 작성 이벤트
    const newCommentText = document.getElementById('newCommentText');
    const submitComment = document.getElementById('submitComment');
    if (submitComment && newCommentText) {
        const submitHandler = async () => {
            if (!state.session) {
                alert('로그인이 필요합니다');
                return;
            }
            const text = newCommentText.value.trim();
            if (!text) {
                alert('댓글 내용을 입력해주세요.');
                return;
            }

            submitComment.disabled = true;
            submitComment.textContent = '등록 중...';

            const { error } = await state.supabase.from('request_comments').insert({
                request_id: requestId,
                user_id: state.session.user.id,
                comment: text,
            });

            submitComment.disabled = false;
            submitComment.textContent = '댓글 등록';

            if (error) {
                const errorMsg = translateError(error);
                const fullError = error.message || String(error);
                console.error('댓글 등록 오류:', error);
                
                if (fullError.includes('schema cache') || fullError.includes('does not exist') || fullError.includes('Could not find')) {
                    alert('댓글 테이블을 찾을 수 없습니다.\n\n다음을 확인해주세요:\n1. SQL이 성공적으로 실행되었는지 확인\n2. 테이블 이름이 정확히 "request_comments"인지 확인\n3. Supabase 페이지를 새로고침하여 캐시 갱신\n\n오류: ' + fullError);
                } else {
                    alert('댓글 등록 실패: ' + errorMsg + '\n\n상세: ' + fullError);
                }
                return;
            }

            // 댓글 목록 새로고침
            await loadComments();
            
            // 댓글 입력란 초기화
            const updatedTextArea = document.getElementById('newCommentText');
            if (updatedTextArea) updatedTextArea.value = '';
        };

        submitComment.addEventListener('click', submitHandler);
    }

    commentsViewDialog.showModal();

    // 댓글 로드
    await loadComments();

    async function loadComments() {
        // 먼저 테이블 존재 확인을 위한 간단한 쿼리 시도
        let { data: comments, error } = await state.supabase
            .from('request_comments')
            .select('id')
            .limit(1);

        // 테이블이 없는 경우
        if (error && (error.message?.includes('schema cache') || error.message?.includes('Could not find'))) {
            commentsList.innerHTML = `
                <div class="card" style="padding:20px;text-align:center">
                    <p class="muted" style="margin-bottom:12px;color:var(--warn)">⚠️ 댓글 테이블을 찾을 수 없습니다</p>
                    <p class="muted" style="font-size:12px;margin-bottom:8px">다음을 확인해주세요:</p>
                    <ol style="text-align:left;font-size:12px;color:var(--muted);padding-left:20px;margin:8px 0;line-height:1.6">
                        <li>Supabase 대시보드 → Table Editor에서 'request_comments' 테이블이 있는지 확인</li>
                        <li>없다면 SQL Editor에서 아래 SQL을 다시 실행</li>
                        <li>SQL 실행 후 페이지를 새로고침 (F5)</li>
                        <li>여전히 안 되면 Supabase 대시보드를 완전히 새로고침</li>
                    </ol>
                    <details style="margin-top:12px;text-align:left">
                        <summary style="cursor:pointer;color:var(--primary);font-size:12px">생성 SQL 보기 (IF NOT EXISTS 제거 버전)</summary>
                        <pre style="background:#0c111a;padding:12px;border-radius:8px;overflow-x:auto;text-align:left;font-size:11px;margin-top:8px;white-space:pre-wrap">CREATE TABLE request_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_request_comments_request_id 
ON request_comments(request_id);

ALTER TABLE request_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments" ON request_comments
FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert comments" ON request_comments
FOR INSERT WITH CHECK (auth.role() = 'authenticated');</pre>
                    </details>
                    <p class="muted" style="font-size:11px;margin-top:12px">오류: ${escapeHtml(error.message || String(error))}</p>
                </div>
            `;
            return;
        }

        // 정상적인 경우 전체 댓글 로드
        const { data: commentsData, error: commentsError } = await state.supabase
            .from('request_comments')
            .select('*')
            .eq('request_id', requestId)
            .order('created_at', { ascending: true });

        comments = commentsData;
        error = commentsError;

        if (error) {
            const errorMsg = translateError(error);
            const fullError = error.message || String(error);
            console.error('댓글 로딩 오류:', error);
            
            if (fullError.includes('schema cache') || fullError.includes('does not exist') || fullError.includes('Could not find')) {
                commentsList.innerHTML = `
                    <div class="card" style="padding:20px;text-align:center">
                        <p class="muted" style="margin-bottom:12px;color:var(--warn)">댓글 테이블을 찾을 수 없습니다.</p>
                        <p class="muted" style="font-size:12px;margin-bottom:8px">다음을 확인해주세요:</p>
                        <ul style="text-align:left;font-size:12px;color:var(--muted);padding-left:20px;margin:8px 0">
                            <li>SQL이 성공적으로 실행되었는지 확인</li>
                            <li>테이블 이름이 정확히 'request_comments'인지 확인</li>
                            <li>Supabase 캐시를 새로고침 (페이지 새로고침)</li>
                        </ul>
                        <details style="margin-top:12px;text-align:left">
                            <summary style="cursor:pointer;color:var(--primary);font-size:12px">생성 SQL 보기</summary>
                            <pre style="background:#0c111a;padding:12px;border-radius:8px;overflow-x:auto;text-align:left;font-size:11px;margin-top:8px">
CREATE TABLE request_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_request_comments_request_id 
ON request_comments(request_id);

ALTER TABLE request_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments" ON request_comments
FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert comments" ON request_comments
FOR INSERT WITH CHECK (auth.role() = 'authenticated');
                            </pre>
                        </details>
                        <p class="muted" style="font-size:11px;margin-top:12px">오류 상세: ${escapeHtml(fullError)}</p>
                    </div>
                `;
            } else {
                commentsList.innerHTML = `<div class="card"><p class="muted">댓글 로딩 실패: ${escapeHtml(errorMsg)}</p><p class="muted" style="font-size:11px;margin-top:8px">${escapeHtml(fullError)}</p></div>`;
            }
            return;
        }

        if (!comments || comments.length === 0) {
            commentsList.innerHTML = '<div class="comment-item" style="text-align:center;padding:40px"><p class="muted">아직 댓글이 없습니다.</p></div>';
            return;
        }

        // 작성자 정보 조회
        const userIds = [...new Set(comments.map(c => c.user_id).filter(Boolean))];
        let handlesByUserId = {};
        if (userIds.length > 0) {
            try {
                const { data: profs } = await state.supabase
                    .from('profiles')
                    .select('user_id, handle')
                    .in('user_id', userIds);
                (profs || []).forEach(p => {
                    if (p.handle) handlesByUserId[p.user_id] = p.handle;
                });
            } catch(_) {}
        }

        commentsList.innerHTML = comments.map(comment => {
            const date = new Date(comment.created_at).toLocaleString('ko-KR', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            const authorName = handlesByUserId[comment.user_id] || comment.user_id?.slice(0,8) || '익명';
            const isOwner = !!state.session && state.session.user.id === comment.user_id;

            return `
                <div class="comment-item" data-comment-id="${comment.id}">
                    <div class="comment-header">
                        <div class="comment-author">
                            <strong>${escapeHtml(authorName)}</strong>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px">
                            <span class="comment-date muted">${date}</span>
                            ${isOwner || state.isAdmin ? `<button class="btn-comment-delete" data-comment-id="${comment.id}" style="padding:2px 8px;font-size:11px;height:24px" title="${state.isAdmin ? '관리자 권한으로 삭제' : '댓글 삭제'}">삭제</button>` : ''}
                        </div>
                    </div>
                    <div class="comment-body">
                        <p>${escapeHtml(comment.comment)}</p>
                    </div>
                </div>
            `;
        }).join('');

        // 삭제 버튼 이벤트 리스너 추가
        commentsList.querySelectorAll('.btn-comment-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const commentId = e.target.getAttribute('data-comment-id');
                if (!commentId) return;

                const isAdminDelete = state.isAdmin;
                const confirmMsg = isAdminDelete
                    ? '정말 이 댓글을 삭제하시겠습니까?\n\n(관리자 권한으로 삭제됩니다.)'
                    : '정말 이 댓글을 삭제하시겠습니까?';

                if (!confirm(confirmMsg)) return;

                let query = state.supabase
                    .from('request_comments')
                    .delete()
                    .eq('id', commentId);
                
                // 관리자가 아니면 본인 댓글만 삭제 가능
                if (!isAdminDelete) {
                    query = query.eq('user_id', state.session.user.id);
                }

                // 버튼 비활성화 및 로딩 표시
                const deleteBtn = e.target;
                const originalText = deleteBtn.textContent;
                deleteBtn.disabled = true;
                deleteBtn.textContent = '삭제 중...';

                const { error, data } = await query.select();

                deleteBtn.disabled = false;
                deleteBtn.textContent = originalText;

                if (error) {
                    const errorMsg = translateError(error);
                    const fullError = error.message || String(error);
                    console.error('댓글 삭제 오류:', error);
                    
                    if (fullError.includes('permission denied') || fullError.includes('policy') || fullError.includes('RLS')) {
                        if (isAdminDelete) {
                            alert(`댓글 삭제 권한이 없습니다.\n\n관리자 권한으로 삭제하려면 Supabase에서 RLS 정책을 설정해야 합니다.\n\nSupabase SQL Editor에서 다음을 실행하세요:\n\n-- 기존 정책이 있으면 삭제 후 재생성\nDROP POLICY IF EXISTS "Admins can delete any comment" ON request_comments;\n\nCREATE POLICY "Admins can delete any comment" ON request_comments\n  FOR DELETE USING (\n    auth.jwt() ->> 'email' IN ('wjekzzz@gmail.com')\n  );`);
                        } else {
                            alert(`댓글 삭제 권한이 없습니다.\n\n본인이 작성한 댓글만 삭제할 수 있습니다.\n\n이미 "Users can delete own comments" 정책이 있다면 문제없습니다.`);
                        }
                    } else {
                        alert(`댓글 삭제 실패: ${errorMsg}\n\n상세 오류:\n${fullError}\n\n콘솔에서 더 자세한 정보를 확인할 수 있습니다.`);
                    }
                    return;
                }

                // 댓글 목록 새로고침
                await loadComments();
            });
        });
    }
}

// 리뷰 보기 다이얼로그
async function openReviewsViewDialog(userId, userHandle) {
    const reviewsViewDialog = document.getElementById('reviewsViewDialog');
    const reviewsViewTitle = document.getElementById('reviewsViewTitle');
    const reviewsViewClose = document.getElementById('reviewsViewClose');
    const reviewsList = document.getElementById('reviewsList');

    reviewsViewTitle.textContent = `${escapeHtml(userHandle || userId.slice(0,8))}님의 리뷰`;
    reviewsList.innerHTML = '<p class="muted" style="text-align:center;padding:20px">로딩 중...</p>';

    // 기존 이벤트 리스너 제거 후 새로 추가
    const closeHandler = () => reviewsViewDialog.close();
    reviewsViewClose.replaceWith(reviewsViewClose.cloneNode(true));
    const newCloseBtn = document.getElementById('reviewsViewClose');
    newCloseBtn.addEventListener('click', closeHandler);

    reviewsViewDialog.showModal();

    // 리뷰 로드
    const { data: reviews, error } = await state.supabase
        .from('reviews_view')
        .select('*')
        .eq('reviewed_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        reviewsList.innerHTML = `<div class="card"><p class="muted">리뷰 로딩 실패: ${escapeHtml(translateError(error))}</p></div>`;
        return;
    }

    if (!reviews || reviews.length === 0) {
        reviewsList.innerHTML = '<div class="comment-item" style="text-align:center;padding:40px"><p class="muted">아직 리뷰가 없습니다.</p></div>';
        return;
    }

    reviewsList.innerHTML = reviews.map(review => {
        const ratingStars = '★'.repeat(Number(review.rating));
        const emptyStars = '☆'.repeat(5 - Number(review.rating));
        const date = new Date(review.created_at).toLocaleString('ko-KR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        const reviewerName = review.reviewer_email || review.reviewer_user_id?.slice(0,8) || '익명';
        
        return `
            <div class="comment-item">
                <div class="comment-header">
                    <div class="comment-author">
                        <strong>${escapeHtml(reviewerName)}</strong>
                        <span class="comment-rating"><span class="rating">${ratingStars}</span><span class="muted">${emptyStars}</span></span>
                    </div>
                    <span class="comment-date muted">${date}</span>
                </div>
                <div class="comment-body">
                    ${review.comment ? `<p>${escapeHtml(review.comment)}</p>` : '<p class="muted">코멘트 없음</p>'}
                </div>
            </div>
        `;
    }).join('');

    // 평균 평점 계산
    const avgRating = reviews.reduce((sum, r) => sum + Number(r.rating), 0) / reviews.length;
    const avgStars = '★'.repeat(Math.round(avgRating));
    const emptyAvgStars = '☆'.repeat(5 - Math.round(avgRating));
    
    reviewsViewTitle.innerHTML = `
        <div>
            <div>${escapeHtml(userHandle || userId.slice(0,8))}님의 리뷰</div>
            <div style="font-size:12px;font-weight:normal;color:var(--muted);margin-top:4px">
                평균 평점: <span class="rating">${avgStars}</span><span class="muted">${emptyAvgStars}</span> (${reviews.length}개)
            </div>
        </div>
    `;
}

// 리뷰 작성 다이얼로그
async function openReviewDialog(reviewedUserId) {
    if (!state.session) {
        alert('로그인이 필요합니다');
        return;
    }

    const reviewDialog = document.getElementById('reviewDialog');
    const reviewForm = document.getElementById('reviewForm');
    const ratingSelector = document.getElementById('ratingSelector');
    const ratingLabel = document.getElementById('ratingLabel');
    const reviewComment = document.getElementById('reviewComment');
    const reviewClose = document.getElementById('reviewClose');
    const reviewSubmit = document.getElementById('reviewSubmit');

    // 초기화
    reviewComment.value = '';
    ratingLabel.textContent = '평점을 선택해주세요';
    let selectedRating = 0;
    
    // 모든 별점 버튼 초기화
    ratingSelector.querySelectorAll('.rating-btn').forEach(btn => {
        btn.classList.remove('active', 'selected');
    });

    // 별점 선택 이벤트 (이벤트 위임으로 중복 방지)
    const handleRatingClick = (e) => {
        if (e.target.classList.contains('rating-btn')) {
            const rating = parseInt(e.target.getAttribute('data-rating'));
            selectedRating = rating;
            
            // 모든 버튼 초기화
            ratingSelector.querySelectorAll('.rating-btn').forEach(b => {
                b.classList.remove('active', 'selected');
            });
            
            // 선택된 별점까지 활성화
            ratingSelector.querySelectorAll('.rating-btn').forEach((b, index) => {
                if (index + 1 <= rating) {
                    b.classList.add('active', 'selected');
                }
            });
            
            // 라벨 업데이트
            ratingLabel.textContent = `${rating}점을 선택했습니다`;
        }
    };

    ratingSelector.addEventListener('click', handleRatingClick);

    // 호버 효과 (이벤트 위임으로 중복 방지)
    const handleMouseEnter = (e) => {
        if (e.target.classList.contains('rating-btn')) {
            const hoverRating = parseInt(e.target.getAttribute('data-rating'));
            ratingSelector.querySelectorAll('.rating-btn').forEach((b, index) => {
                b.classList.remove('active');
                if (index + 1 <= hoverRating) {
                    b.classList.add('active');
                }
            });
        }
    };

    const handleMouseLeave = () => {
        ratingSelector.querySelectorAll('.rating-btn').forEach((b, index) => {
            b.classList.remove('active');
            if (index + 1 <= selectedRating) {
                b.classList.add('active', 'selected');
            }
        });
    };

    ratingSelector.addEventListener('mouseenter', handleMouseEnter, true);
    ratingSelector.addEventListener('mouseleave', handleMouseLeave);

    // 폼 제출
    reviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (selectedRating === 0) {
            alert('평점을 선택해주세요.');
            return;
        }

        const comment = reviewComment.value.trim();

        reviewSubmit.disabled = true;
        reviewSubmit.textContent = '등록 중...';

    const { error } = await state.supabase.from('reviews').insert({
        reviewed_user_id: reviewedUserId,
        reviewer_user_id: state.session.user.id,
            rating: selectedRating,
        comment,
    });

        reviewSubmit.disabled = false;
        reviewSubmit.textContent = '등록';

        if (error) {
            alert('리뷰 등록 실패: ' + translateError(error));
            return;
        }

        reviewDialog.close();
    alert('리뷰가 등록되었습니다.');
        
        // 프로필 페이지면 새로고침
        if (location.hash === '#/profile') {
            handleRoute();
        }
    });

    // 닫기 버튼
    reviewClose.addEventListener('click', () => {
        reviewDialog.close();
    });

    reviewDialog.showModal();
}

// 유틸
function escapeHtml(str) {
    return String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

// Supabase 오류 메시지 한국어 번역
function translateError(error) {
    if (!error) return '알 수 없는 오류';
    const message = error.message || String(error);
    const lowerMessage = message.toLowerCase();

    // 인증 관련 오류
    if (lowerMessage.includes('invalid login credentials') || lowerMessage.includes('invalid credentials')) {
        return '이메일 또는 비밀번호가 올바르지 않습니다.';
    }
    if (lowerMessage.includes('email not confirmed')) {
        return '이메일 인증이 완료되지 않았습니다. 이메일을 확인해주세요.';
    }
    if (lowerMessage.includes('user already registered') || lowerMessage.includes('user already exists')) {
        return '이미 등록된 이메일입니다.';
    }
    if (lowerMessage.includes('password')) {
        if (lowerMessage.includes('weak') || lowerMessage.includes('too short')) {
            return '비밀번호가 너무 약합니다. 더 강한 비밀번호를 사용해주세요.';
        }
        if (lowerMessage.includes('minimum')) {
            return '비밀번호는 최소 6자 이상이어야 합니다.';
        }
    }
    if (lowerMessage.includes('email')) {
        if (lowerMessage.includes('invalid') || lowerMessage.includes('format')) {
            return '올바른 이메일 형식이 아닙니다.';
        }
    }

    // 데이터베이스 관련 오류
    if (lowerMessage.includes('could not find the table') || lowerMessage.includes('does not exist') || lowerMessage.includes('schema cache')) {
        if (lowerMessage.includes('request_comments')) {
            return '댓글 테이블이 아직 생성되지 않았습니다. 관리자에게 문의해주세요.';
        }
        return '데이터베이스 테이블을 찾을 수 없습니다. 관리자에게 문의해주세요.';
    }
    if (lowerMessage.includes('duplicate key') || lowerMessage.includes('unique constraint')) {
        return '이미 존재하는 데이터입니다.';
    }
    if (lowerMessage.includes('foreign key constraint') || lowerMessage.includes('violates foreign key')) {
        return '관련된 데이터가 없어 작업을 수행할 수 없습니다.';
    }
    if (lowerMessage.includes('not null') || lowerMessage.includes('null value')) {
        return '필수 항목이 누락되었습니다.';
    }
    if (lowerMessage.includes('permission denied') || lowerMessage.includes('row-level security')) {
        return '권한이 없습니다. 로그인 후 다시 시도해주세요.';
    }
    if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
        return '네트워크 연결 오류가 발생했습니다. 인터넷 연결을 확인해주세요.';
    }
    if (lowerMessage.includes('timeout')) {
        return '요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';
    }
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
        return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
    }

    // 일반 오류
    if (lowerMessage.includes('not found')) {
        return '요청한 데이터를 찾을 수 없습니다.';
    }
    if (lowerMessage.includes('unauthorized') || lowerMessage.includes('forbidden')) {
        return '접근 권한이 없습니다.';
    }
    if (lowerMessage.includes('server error') || lowerMessage.includes('internal error')) {
        return '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    }

    // 번역할 수 없는 경우 원본 메시지 반환
    return message;
}

// 메시지 알림 시스템
async function startMessageNotifications() {
    if (!state.session || state.messageCheckInterval) return;
    
    // 브라우저 알림 권한 요청
    if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
    }
    
    state.messageCheckInterval = setInterval(async () => {
        await checkNewMessages();
    }, 5000); // 5초마다 확인
}

function stopMessageNotifications() {
    if (state.messageCheckInterval) {
        clearInterval(state.messageCheckInterval);
        state.messageCheckInterval = null;
    }
}

async function checkNewMessages() {
    if (!state.session || !state.supabase) return;
    
    const userId = state.session.user.id;
    
    try {
        // 마지막 확인 시간 이후의 새 메시지 가져오기
        let query = state.supabase
            .from('messages')
            .select('id, sender_id, receiver_id, message, request_id, created_at')
            .eq('receiver_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (state.lastCheckedMessageTime) {
            query = query.gt('created_at', state.lastCheckedMessageTime);
        }
        
        const { data: newMessages, error } = await query;
        
        if (error) {
            console.warn('메시지 확인 오류:', error);
            return;
        }
        
        // 새 메시지가 있는지 확인
        if (newMessages && newMessages.length > 0) {
            // 현재 해당 대화방을 보고 있는지 확인
            const unreadMessages = newMessages.filter(msg => {
                // 현재 열려있는 메시지 다이얼로그가 없거나, 다른 대화방이면 알림 표시
                if (!state.activeMessageDialog) return true;
                
                const active = state.activeMessageDialog;
                // 같은 request_id와 상대방이면 알림 안 표시
                return !(msg.request_id === active.requestId && 
                        (msg.sender_id === active.receiverId || msg.sender_id === active.senderId));
            });
            
            if (unreadMessages.length > 0) {
                // 가장 최근 메시지로 알림
                const latestMessage = unreadMessages[0];
                
                // 사용자 핸들 가져오기
                let senderHandle = '익명';
                try {
                    const { data: prof } = await state.supabase
                        .from('profiles')
                        .select('handle')
                        .eq('user_id', latestMessage.sender_id)
                        .maybeSingle();
                    if (prof?.handle) senderHandle = prof.handle;
                } catch(_) {}
                
                // 브라우저 알림 표시
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('새 메시지', {
                        body: `${senderHandle}: ${latestMessage.message.substring(0, 50)}${latestMessage.message.length > 50 ? '...' : ''}`,
                        icon: '/favicon.ico',
                        tag: `message-${latestMessage.id}`,
                        requireInteraction: false,
                    });
                }
                
                // 페이지 타이틀에 알림 표시
                updatePageTitleWithNotification(true);
            }
        }
        
        // 마지막 확인 시간 업데이트
        if (newMessages && newMessages.length > 0) {
            state.lastCheckedMessageTime = newMessages[0].created_at;
        } else {
            state.lastCheckedMessageTime = new Date().toISOString();
        }
    } catch(err) {
        console.error('메시지 확인 중 오류:', err);
    }
}

// 페이지 타이틀에 알림 표시/제거
let originalTitle = document.title;
function updatePageTitleWithNotification(hasNotification) {
    if (hasNotification) {
        if (!document.title.startsWith('🔔 ')) {
            document.title = '🔔 ' + originalTitle;
        }
    } else {
        document.title = originalTitle;
    }
}

// 페이지 포커스 시 타이틀 정리
window.addEventListener('focus', () => {
    updatePageTitleWithNotification(false);
});

// 프로필(핸들) 보장: 없으면 한 번 입력 받아 저장
async function ensureProfile() {
    const uid = state.session?.user?.id;
    if (!uid) return;
    try {
        const { data: prof } = await state.supabase.from('profiles').select('user_id, handle').eq('user_id', uid).maybeSingle();
        if (prof && prof.handle) return;
    } catch (_) {
        // 프로필 테이블이 없으면 무시
        return;
    }

    // 간단한 핸들 입력
    let handle = '';
    for (let i=0; i<3; i++) {
        handle = prompt('표시할 아이디(영문/숫자/밑줄, 3~20자):', '') || '';
        if (!handle) return; // 사용자가 취소한 경우
        if (!/^[-_a-zA-Z0-9]{3,20}$/.test(handle)) { alert('형식이 올바르지 않습니다.'); continue; }
        const { error } = await state.supabase.from('profiles').upsert({ user_id: uid, handle }, { onConflict: 'user_id' });
        if (error) { alert(translateError(error) || '저장 실패'); continue; }
        break;
    }
}




// 시작
window.addEventListener('DOMContentLoaded', initApp);


