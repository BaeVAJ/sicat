// src/components/layout/Layout.jsx
import Sidebar from './sidebar';
import SistemasAlertas from './SistemasAlertas';
import './sidebar.css';

function Layout({ children }) {
    return (
        <div className="app-layout">
            <Sidebar />
            <SistemasAlertas />
            <main className="app-layout__content">
                {children}
            </main>
        </div>
    );
}

export default Layout;