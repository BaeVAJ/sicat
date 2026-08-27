// src/components/layout/Layout.jsx
import Sidebar from './sidebar';
import './sidebar.css';

function Layout({ children }) {
    return (
        <div className="app-layout">
            <Sidebar />
            <main className="app-layout__content">
                {children}
            </main>
        </div>
    );
}

export default Layout;