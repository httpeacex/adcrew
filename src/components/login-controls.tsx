'use client';

import { useRef, useState } from 'react';
import { ArrowRight, Beaker, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, X } from 'lucide-react';
import { demoProfiles } from '@/lib/demo-profiles';
import { roles } from '@/lib/workflow';
import { RequestForm, SessionForm } from './forms';
import styles from './login.module.css';

export function LoginCredentials() {
  const [showPassword, setShowPassword] = useState(false);
  return <RequestForm url="/api/session">{({ busy }) => <fieldset disabled={busy} className={styles.fields}>
    <label className={styles.field} htmlFor="login-email">Эл. почта</label>
    <div className={styles.inputWrap}>
      <Mail size={17} aria-hidden="true" />
      <input id="login-email" type="email" name="email" autoComplete="username" maxLength={254} required placeholder="Введите адрес почты" />
    </div>
    <label className={styles.field} htmlFor="login-password">Пароль</label>
    <div className={styles.inputWrap}>
      <LockKeyhole size={17} aria-hidden="true" />
      <input id="login-password" type={showPassword ? 'text' : 'password'} name="password" autoComplete="current-password" required maxLength={256} placeholder="Введите пароль" />
      <button className={styles.passwordToggle} type="button" aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>
        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
    <button className={`button primary ${styles.submit}`} type="submit">{busy ? <><LoaderCircle size={17} className="spin" /> Входим…</> : <>Войти в аккаунт <ArrowRight size={16} /></>}</button>
  </fieldset>}</RequestForm>;
}

export function DemoLogin() {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button type="button" className={styles.demoTrigger} onClick={() => dialog.current?.showModal()}><Beaker size={16} aria-hidden="true" /> Тестовый вход</button>
    <dialog className={styles.demoDialog} ref={dialog} aria-labelledby="demo-login-title" aria-describedby="demo-login-description" onClick={(event) => {
      if (event.target === event.currentTarget) dialog.current?.close();
    }}>
      <div className={styles.dialogContent}>
        <div className={styles.dialogHeader}><h2 id="demo-login-title">Выберите роль</h2><button className={styles.closeDialog} type="button" aria-label="Закрыть тестовый вход" onClick={() => dialog.current?.close()}><X size={20} /></button></div>
        <p id="demo-login-description">Откройте демо AdCrew сразу, без почты и пароля.</p>
        <SessionForm className={styles.demoForm}>{[demoProfiles[0], demoProfiles[2], demoProfiles[4]].map((person) => <button className={`demo-account ${styles.demoAccount}`} type="submit" name="demo" value={person.id} key={person.id}>
          <span className={styles.demoAvatar}>{person.initials}</span><span><strong>{roles[person.role]}</strong><small>{person.name}</small></span><ArrowRight size={18} aria-hidden="true" />
        </button>)}</SessionForm>
      </div>
    </dialog>
  </>;
}
