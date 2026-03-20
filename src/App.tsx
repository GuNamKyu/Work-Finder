import { useState } from 'react';
import { UploadCloud, FileSpreadsheet, Search, Building2, ExternalLink, AlertCircle, Info } from 'lucide-react';
import { parseExcelFile, type OrganizationInfo } from './utils/excelParser';
import { scrapeWebsite, type ScrapeResult } from './utils/scraper';
import './App.css';

interface DisplayResult extends OrganizationInfo {
  postings: {
    title: string;
    regDate: string;
    deadlineDate?: string | null;
  }[];
}

function OrganizationCard({ result }: { result: DisplayResult }) {
  const [page, setPage] = useState(1);
  const POSTS_PER_PAGE = 3;
  const totalPages = Math.ceil(result.postings.length / POSTS_PER_PAGE);

  const displayedPostings = result.postings.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);

  return (
    <div className="result-card">
      <div className="card-header">
        <h3 className="org-name">{result.orgName}</h3>
        <span className="badge">신규 공고 {result.postings.length}건</span>
      </div>
      
      <div className="postings-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
        {displayedPostings.map((posting, idx) => (
          <div key={idx} className="posting-item" style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div className="card-title-box" style={{ marginBottom: '0.5rem' }}>
              <p style={{ fontWeight: 600, color: 'var(--text-color)', lineHeight: 1.4, margin: 0 }}>
                {posting.title}
              </p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
              <div className="card-meta">
                <span style={{ fontWeight: 600 }}>등록일:</span>
                <span>{posting.regDate}</span>
              </div>
              {posting.deadlineDate && (
                <div className="card-meta">
                  <span style={{ fontWeight: 600 }}>접수 마감일:</span>
                  <span style={{ color: 'var(--primary-light)' }}>{posting.deadlineDate}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="card-pagination" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
            <button
              key={pageNum}
              onClick={() => setPage(pageNum)}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                border: '1px solid var(--primary-color)',
                backgroundColor: page === pageNum ? 'var(--primary-color)' : 'transparent',
                color: page === pageNum ? '#fff' : 'var(--primary-color)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                transition: 'all 0.2s'
              }}
            >
              {pageNum}
            </button>
          ))}
        </div>
      )}

      <div className="card-action" style={{ marginTop: '1.25rem' }}>
        <a 
          href={result.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="btn-link"
        >
          홈페이지 바로가기
          <ExternalLink size={16} />
        </a>
      </div>
    </div>
  );
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [results, setResults] = useState<DisplayResult[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = (selectedFile: File) => {
    if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
      setFile(selectedFile);
      setErrorMsg('');
      setResults([]);
      setCurrentPage(1);
      setProgress(0);
      setStatusMsg('');
    } else {
      setErrorMsg('지원하지 않는 파일 형식입니다. 엑셀 파일(.xlsx, .xls)을 업로드해주세요.');
    }
  };

  const handleStartProcess = async () => {
    if (!file) return;

    setIsProcessing(true);
    setErrorMsg('');
    setResults([]);
    setCurrentPage(1);
    setProgress(0);
    setStatusMsg('엑셀 파일을 분석 중입니다...');

    try {
      const orgs = await parseExcelFile(file);
      
      if (orgs.length === 0) {
        setErrorMsg('엑셀 파일에서 유효한 데이터를 찾을 수 없습니다.');
        setIsProcessing(false);
        return;
      }

      const foundResults: DisplayResult[] = [];
      const total = orgs.length;

      for (let i = 0; i < total; i++) {
        const org: OrganizationInfo = orgs[i];
        setStatusMsg(`[${i + 1}/${total}] ${org.orgName} 웹사이트 확인 중...`);
        
        const scrapeInfo: ScrapeResult = await scrapeWebsite(org.url);
        
        if (scrapeInfo.hasKeyword && scrapeInfo.postings.length > 0) {
          foundResults.push({
            ...org,
            postings: scrapeInfo.postings
          });
          // Update partial results immediately for better UX
          setResults([...foundResults]);
        }

        setProgress(Math.round(((i + 1) / total) * 100));
        
        // Artificial delay to prevent overwhelming the proxy server
        await new Promise(res => setTimeout(res, 300));
      }

      // 기관들을 가장 최신 등록일(첫번째 공고의 등록일) 기준으로 내림차순 정렬 (최신 기관 상단 배치)
      // 단, 내부 공고들은 이미 오름차순(일찍 등록된 순)으로 정렬되어 있음
      foundResults.sort((a, b) => {
         const aLatest = Math.max(...a.postings.map(p => new Date(p.regDate).getTime()));
         const bLatest = Math.max(...b.postings.map(p => new Date(p.regDate).getTime()));
         return bLatest - aLatest;
      });
      setResults(foundResults);
      setStatusMsg('모든 확인 작업이 완료되었습니다.');
      
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || '처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1 className="header-title">
          <Search size={40} color="var(--primary-color)" />
          <span>채용공고 어그리게이터</span>
        </h1>
        <p className="header-subtitle">
          여러 기관 웹사이트를 한 번에 방문하여 채용, 공고, 모집 관련 최신 소식을 모아보세요.
        </p>
      </header>

      <main className="main-content">
        {/* Upload & Controls Section */}
        <section className="glass-panel upload-section">
          <h2 className="section-title">
            <FileSpreadsheet size={24} />
            데이터 업로드
          </h2>
          
          <div 
            className={`file-upload-box ${isDragging ? 'drag-active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input 
              type="file" 
              className="file-input" 
              accept=".xlsx,.xls" 
              onChange={handleFileChange}
              disabled={isProcessing}
            />
            <UploadCloud className="upload-icon" />
            <p className="upload-text">엑셀 파일을 이곳으로 드래그하거나 클릭하세요</p>
            <p className="upload-hint">지원 형식: .xlsx, .xls</p>
          </div>

          {errorMsg && (
            <div style={{ color: '#ef4444', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} />
              {errorMsg}
            </div>
          )}

          {file && !errorMsg && (
            <div className="selected-file-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileSpreadsheet size={16} color="var(--success-color)" />
                <span className="file-name">{file.name}</span>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {(file.size / 1024).toFixed(1)} KB
              </span>
            </div>
          )}

          <button 
            className="btn-primary" 
            onClick={handleStartProcess}
            disabled={!file || isProcessing || !!errorMsg}
          >
            {isProcessing ? (
              <>
                <Search className="animate-spin" size={20} />
                공고 확인 중... {progress}%
              </>
            ) : (
              <>
                <Search size={20} />
                공고확인 시작
              </>
            )}
          </button>

          <div className="notice-box" style={{ 
            marginTop: '1.5rem', 
            padding: '1.25rem', 
            backgroundColor: 'var(--bg-secondary)', 
            borderRadius: '8px', 
            border: '1px solid var(--border-color)',
            fontSize: '0.9rem',
            color: 'var(--text-color)'
          }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--primary-color)' }}>
              <Info size={18} />
              유의사항 및 시스템 자동 제외 필터 안내
            </h4>
            <p style={{ marginBottom: '0.5rem' }}>검색 결과의 정확도를 높이기 위해, 문화·예술·박물관 지정 분야와 거리가 먼 다음 유형의 공고들은 <b>검색 대상에서 자동으로 제외</b>됩니다.</p>
            <ul style={{ paddingLeft: '1.5rem', listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: '0.3rem', color: 'var(--text-light)' }}>
              <li><b>결과 및 채용과정:</b> 합격자 발표, 서류 전형 결과, 응시 현황, 면접 과정 등</li>
              <li><b>초고위/별정직 및 공무원:</b> 1~5급 공무원, 대표이사, 본부장, 실장, 가급 연구원 등</li>
              <li><b>교육/강사 및 의료/복지:</b> 각종 강사, 기간제교원, 교원, 교사, 의사, 의료인, 사회복지 등</li>
              <li><b>시설 유지 및 현장관리:</b> 시설미화원, 환경정비, 청사/주차관리, 조리원, 조리 등</li>
              <li><b>특수 및 일반행정 기타:</b> 선거지원단, 행정실무사, 회계, 농업경영, 예술단 단원, 검찰청, 킨텍스 등</li>
            </ul>
          </div>

          {isProcessing && (
            <div className="progress-container">
              <div className="progress-header">
                <span>진행 상황</span>
                <span>{progress}%</span>
              </div>
              <div className="progress-bar-bg">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="status-text">{statusMsg}</p>
            </div>
          )}
          {!isProcessing && statusMsg && (
             <p className="status-text" style={{ color: 'var(--success-color)' }}>{statusMsg}</p>
          )}
        </section>

        {/* Results Section */}
        <section className="glass-panel results-section">
          <div className="results-header">
            <h2 className="section-title">
              <Building2 size={24} />
              검색 결과
            </h2>
            {results.length > 0 && (
              <span className="results-count">발견 완료: {results.length}기관</span>
            )}
          </div>

          <div className="results-grid">
            {results.length > 0 ? (
              results.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((result, index) => (
                <OrganizationCard key={result.id || index} result={result} />
              ))
            ) : (
              <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                <Search className="empty-icon" />
                <p>
                  {statusMsg === '모든 확인 작업이 완료되었습니다.' 
                    ? '관련 키워드가 포함된 공고를 찾을 수 없습니다.' 
                    : '아직 검색 결과가 없습니다.'}
                </p>
                <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  {statusMsg === '모든 확인 작업이 완료되었습니다.'
                    ? '다른 엑셀 파일을 시도해보세요.'
                    : '엑셀 파일을 업로드하고 공고확인을 시작해주세요.'}
                </p>
              </div>
            )}
          </div>
          
          {/* Pagination */}
          {results.length > ITEMS_PER_PAGE && (
            <div className="pagination" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem' }}>
              {Array.from({ length: Math.ceil(results.length / ITEMS_PER_PAGE) }, (_, i) => i + 1).map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--primary-color)',
                    backgroundColor: currentPage === pageNum ? 'var(--primary-color)' : 'transparent',
                    color: currentPage === pageNum ? '#fff' : 'var(--primary-color)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'all 0.2s'
                  }}
                >
                  {pageNum}
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
