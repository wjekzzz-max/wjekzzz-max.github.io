import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Supabase 설정: 아래 두 값을 본인 프로젝트 값으로 변경하세요.
const SUPABASE_URL = window.SUPABASE_URL || 'https://ukzyflvgnagekrlxfsdp.supabase.co';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrenlmbHZnbmFnZWtybHhmc2RwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4ODUxOTEsImV4cCI6MjA3NzQ2MTE5MX0.OOZhNNJN4zeKC10vHcSC9JWtbxzzz514jbOOcRCqDBA';

// 전역 상태
const state = {
    supabase: null,
    session: null,
    pendingReportTarget: null,
};

// 초기화
async function initApp() {
    // 연도 표기
    const y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();

    // Supabase 클라이언트
    state.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data } = await state.supabase.auth.getSession();
    state.session = data.session;

    setupAuthUI();
    setupRouting();
}

function setupAuthUI() {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const authDialog = document.getElementById('authDialog');
    const authClose = document.getElementById('authClose');
    const toggleAuthMode = document.getElementById('toggleAuthMode');
    const authForm = document.getElementById('authForm');
    const authTitle = document.getElementById('authTitle');
    const authSubmit = document.getElementById('authSubmit');
    const authPassword2Input = document.getElementById('authPassword2');

    let isSignup = false;

    function updateButtons() {
        if (state.session) {
            loginBtn.style.display = 'none';
            logoutBtn.style.display = '';
        } else {
            loginBtn.style.display = '';
            logoutBtn.style.display = 'none';
        }
    }
    updateButtons();

    loginBtn.addEventListener('click', () => {
        isSignup = false;
        authTitle.textContent = '로그인';
        authSubmit.textContent = '로그인';
        toggleAuthMode.textContent = '회원가입';
        authDialog.showModal();
    });
    logoutBtn.addEventListener('click', async () => {
        await state.supabase.auth.signOut();
        state.session = null;
        updateButtons();
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
                const { data: signUpData, error: signUpError } = await state.supabase.auth.signUp({ email, password });
                if (signUpError) throw signUpError;
                // 일부 설정에서는 즉시 세션이 생기지 않고 이메일 확인이 필요함
                if (signUpData.session) {
                    state.session = signUpData.session;
                    try { await ensureProfile(); } catch(_) {}
                    authDialog.close();
                    updateButtons();
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
                        try { await ensureProfile(); } catch(_) {}
                        authDialog.close();
                        updateButtons();
                        navigateTo('#/');
                    }
                }
            } else {
                const { data, error } = await state.supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                state.session = data.session;
                try { await ensureProfile(); } catch(_) {}
                authDialog.close();
                updateButtons();
                navigateTo('#/');
            }
        } catch (err) {
            alert(translateError(err) || '오류가 발생했습니다.');
        }
    });

    state.supabase.auth.onAuthStateChange(async (_event, session) => {
        state.session = session;
        updateButtons();
        if (session?.user) {
            try { await ensureProfile(); } catch (_) {}
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
}

// 라우팅
const routes = {
    '#/': renderHome,
    '#/requests': renderRequests,
    '#/new-request': renderNewRequest,
    '#/profile': renderProfile,
    '#/customer': renderCustomer,
    '#/report': renderReport,
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
    const page = routes[hash] || routes['#/'];
    
    // 활성화된 네비게이션 링크 표시
    updateActiveNav(hash);
    
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
        list.innerHTML = data.map((item) => renderRequestItem(item, handlesByUserId)).join('');
        document.querySelectorAll('[data-action="view-comments"]').forEach((btn) => btn.addEventListener('click', onClickViewComments));
        document.querySelectorAll('[data-action="view-reviews"]').forEach((btn) => btn.addEventListener('click', onClickViewReviews));
        document.querySelectorAll('[data-action="review"]').forEach((btn) => btn.addEventListener('click', onClickReview));
        document.querySelectorAll('[data-action="report-user"]').forEach((btn) => btn.addEventListener('click', onClickReportUser));
        document.querySelectorAll('[data-action="delete"]').forEach((btn) => btn.addEventListener('click', onClickDelete));
    }

    function renderRequestItem(item, handlesByUserId) {
        const rating = item.avg_rating ? Number(item.avg_rating).toFixed(1) : '-';
        const isOwner = !!state.session && state.session.user.id === item.owner_user_id;
        const handle = handlesByUserId?.[item.owner_user_id] || (item.owner_user_id ? item.owner_user_id.slice(0,8) : '-');
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
          <button class="btn" data-action="view-comments" data-request-id="${item.id}" data-request-title="${escapeHtml(item.title)}">댓글 보기</button>
          <button class="btn" data-action="view-reviews" data-user-id="${item.owner_user_id}" data-user-handle="${handle}">작성자 리뷰</button>
          <button class="btn" data-action="review" data-user-id="${item.owner_user_id}">리뷰 남기기</button>
          <button class="btn" data-action="report-user" data-user-id="${item.owner_user_id}" data-user-handle="${handle}">작성자 신고</button>
          ${isOwner ? `<button class="btn btn-danger" data-action="delete" data-id="${item.id}" data-title="${escapeHtml(item.title)}">삭제</button>` : ''}
        </div>
      </div>
    `;
    }

    function onClickViewComments(e) {
        const requestId = e.currentTarget.getAttribute('data-request-id');
        const requestTitle = e.currentTarget.getAttribute('data-request-title');
        openCommentsViewDialog(requestId, requestTitle);
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

    function onClickReportUser(e) {
        const h = e.currentTarget.getAttribute('data-user-handle');
        const target = h || e.currentTarget.getAttribute('data-user-id');
        state.pendingReportTarget = target;
        navigateTo('#/report');
    }

    async function onClickDelete(e) {
        if (!state.session) {
            alert('로그인이 필요합니다');
            return;
        }
        const id = e.currentTarget.getAttribute('data-id');
        const title = e.currentTarget.getAttribute('data-title') || '이 의뢰';
        if (!id) return;
        
        if (!confirm(`정말 "${title}" 의뢰를 삭제하시겠습니까?\n\n삭제된 의뢰는 복구할 수 없습니다.`)) return;
        
        const deleteBtn = e.currentTarget;
        const originalText = deleteBtn.textContent;
        deleteBtn.disabled = true;
        deleteBtn.textContent = '삭제 중...';
        
        const { error } = await state.supabase
            .from('requests')
            .delete()
            .eq('id', id)
            .eq('owner_user_id', state.session.user.id)
            .select('id');
            
        deleteBtn.disabled = false;
        deleteBtn.textContent = originalText;
        
        if (error) {
            const errorMsg = translateError(error);
            const fullError = error.message || String(error);
            
            if (fullError.includes('permission denied') || fullError.includes('policy')) {
                alert('삭제 권한이 없습니다.\n\nSupabase에서 DELETE 정책을 확인해주세요.');
            } else {
                alert('삭제 실패: ' + errorMsg + '\n\n상세: ' + fullError);
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

// 의뢰 댓글 보기 다이얼로그
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
                            ${isOwner ? `<button class="btn-comment-delete" data-comment-id="${comment.id}" style="padding:2px 8px;font-size:11px;height:24px" title="댓글 삭제">삭제</button>` : ''}
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

                if (!confirm('정말 이 댓글을 삭제하시겠습니까?')) return;

                const { error } = await state.supabase
                    .from('request_comments')
                    .delete()
                    .eq('id', commentId)
                    .eq('user_id', state.session.user.id);

                if (error) {
                    const errorMsg = translateError(error);
                    const fullError = error.message || String(error);
                    
                    if (fullError.includes('permission denied') || fullError.includes('policy')) {
                        alert('댓글 삭제 권한이 없습니다.\n\nSupabase에서 DELETE 정책을 추가해주세요:\n\nCREATE POLICY "Users can delete own comments" ON request_comments\nFOR DELETE USING (auth.uid() = user_id);');
                    } else {
                        alert('댓글 삭제 실패: ' + errorMsg + '\n\n상세: ' + fullError);
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


