import { useEffect, useState } from 'react';

import { getRuntimeConfig, initializeZaloRuntime, type ZaloRuntimeState } from './runtime';
import './styles.css';

export const APP_NAME = 'Xếp hàng dịch vụ công';

export interface AppProps {
  readonly initializeRuntime?: () => Promise<ZaloRuntimeState>;
}

function RuntimeStatus({ state }: { readonly state: ZaloRuntimeState }) {
  if (state.phase === 'initializing') {
    return <p role="status">Đang khởi tạo ứng dụng...</p>;
  }
  if (state.phase === 'configuration-error') {
    return <p role="alert">Cấu hình Zalo Mini App chưa đầy đủ.</p>;
  }
  if (state.phase === 'unsupported') {
    return <p role="alert">Môi trường hiện tại chưa được hỗ trợ.</p>;
  }
  return (
    <p role="status">
      {state.runtime === 'zalo-mini-app'
        ? 'Đang chạy trong Zalo Mini App.'
        : 'Chế độ phát triển trên trình duyệt.'}
    </p>
  );
}

export function App({ initializeRuntime: initializeRuntimeOverride }: AppProps = {}) {
  const [runtimeState, setRuntimeState] = useState<ZaloRuntimeState>({ phase: 'initializing' });

  useEffect(() => {
    let active = true;
    const initialize =
      initializeRuntimeOverride ?? (() => initializeZaloRuntime(getRuntimeConfig()));
    void initialize().then((state) => {
      if (active) {
        setRuntimeState(state);
      }
    });
    return () => {
      active = false;
    };
  }, [initializeRuntimeOverride]);

  return (
    <main className="app-shell">
      <header className="app-header">
        <span className="app-mark" aria-hidden="true">
          Q
        </span>
        <div>
          <p className="app-kicker">Dịch vụ hành chính</p>
          <h1>{APP_NAME}</h1>
        </div>
      </header>

      <section className="runtime-card" aria-label="Trạng thái môi trường">
        <RuntimeStatus state={runtimeState} />
      </section>

      <section className="welcome-card">
        <p className="eyebrow">Trang chủ</p>
        <h2>Chủ động thời gian, giảm thời gian chờ</h2>
        <p>Chọn điểm phục vụ và dịch vụ để chuẩn bị lấy số thứ tự.</p>
      </section>

      <section className="form-card" aria-labelledby="queue-form-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Lấy số trực tuyến</p>
            <h2 id="queue-form-title">Thông tin lượt chờ</h2>
          </div>
          <span className="pending-badge">Đang hoàn thiện</span>
        </div>

        <label htmlFor="location">Điểm phục vụ</label>
        <select id="location" disabled defaultValue="">
          <option value="">Chưa có dữ liệu địa điểm</option>
        </select>

        <label htmlFor="service">Dịch vụ</label>
        <select id="service" disabled defaultValue="">
          <option value="">Chưa có dữ liệu dịch vụ</option>
        </select>

        <button type="button" disabled>
          Lấy số thứ tự
        </button>
        <p className="backend-note">Chức năng sẽ mở khi API Central được xác nhận.</p>
      </section>

      <section className="empty-card" aria-labelledby="current-ticket-title">
        <div className="empty-icon" aria-hidden="true">
          0
        </div>
        <div>
          <h2 id="current-ticket-title">Chưa có lượt đang chờ</h2>
          <p>Lượt đã đăng ký sẽ xuất hiện tại đây sau khi hệ thống được kết nối.</p>
        </div>
      </section>

      <footer>Foundation không yêu cầu thông tin cá nhân hoặc quyền truy cập Zalo.</footer>
    </main>
  );
}
