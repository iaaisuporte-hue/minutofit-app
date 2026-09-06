package com.s2core.app.workout;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * Serviço de primeiro plano da Lock Screen do treino de musculação (P1D).
 *
 * Separado do `LocationForegroundService` (P1B/P1C) de propósito: aquele é
 * `foregroundServiceType="location"` e SÓ sobe com permissão de localização —
 * um serviço iniciado com essa exigência derrubaria (ou obrigaria a pedir
 * permissão sem motivo) quem só está fazendo musculação, sem GPS envolvido em
 * nada. A Play Store audita se o tipo declarado bate com o que o app realmente
 * faz; misturar os dois contextos correria esse risco à toa.
 *
 * `foregroundServiceType="dataSync"`: nenhum dos tipos "certos" (location,
 * camera, microphone, mediaPlayback, phoneCall...) descreve "mostrar
 * progresso de um treino" — é exatamente o tipo genérico que existe para não
 * caber nos outros. Estável desde a API 29, com anos de uso real por apps de
 * mensageria/sincronização; a alternativa mais nova (`specialUse`, API 34)
 * exigiria uma declaração de motivo revisada pela Play Store que este
 * ambiente não tem como validar — `dataSync` é a escolha de menor risco para
 * algo que não posso testar em aparelho.
 *
 * Bem mais simples que o serviço de localização: não há ponto de GPS
 * acumulando (nada de fila/dreno) e não há "pausar a coleta" — só existe
 * `start`/`update`/`stop`. Quem decide TODO o texto é o web, que é o único
 * lado que sabe se o treino está em descanso.
 */
public class WorkoutForegroundService extends Service {

    public static final String ACTION_START = "com.s2core.app.workout.START";
    public static final String ACTION_UPDATE = "com.s2core.app.workout.UPDATE";
    public static final String ACTION_STOP = "com.s2core.app.workout.STOP";

    public static final String EXTRA_TITLE = "titulo";
    public static final String EXTRA_TEXT = "texto";

    private static final String TAG = "S2CoreWorkout";
    private static final String CANAL_ID = "s2core_workout";
    private static final int NOTIFICACAO_ID = 4712;

    private static volatile boolean ativo = false;

    public static boolean estaAtivo() {
        return ativo;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String acao = intent == null ? ACTION_START : intent.getAction();
        if (acao == null) acao = ACTION_START;

        switch (acao) {
            case ACTION_UPDATE: {
                String titulo = intent != null ? intent.getStringExtra(EXTRA_TITLE) : null;
                String texto = intent != null ? intent.getStringExtra(EXTRA_TEXT) : null;
                // Ativo pode já ter virado false entre o disparo do web e a
                // entrega deste Intent (STOP processado um instante antes) — o
                // plugin já filtra a maioria dos casos, isto é o cinto de
                // segurança do lado do serviço (mesmo padrão do tracker).
                if (ativo) atualizarNotificacao(titulo, texto);
                break;
            }
            case ACTION_STOP:
                encerrar();
                return START_NOT_STICKY;
            case ACTION_START:
            default: {
                String titulo = intent != null ? intent.getStringExtra(EXTRA_TITLE) : null;
                String texto = intent != null ? intent.getStringExtra(EXTRA_TEXT) : null;
                ativo = true;
                subirParaPrimeiroPlano(titulo, texto);
                break;
            }
        }

        // START_STICKY: um treino de 1h+ sobrevivendo a uma morte por pressão
        // de memória é o mesmo raciocínio do outdoor tracker — o rascunho já
        // sobrevive (localStorage), a notificação só precisa voltar a existir.
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        ativo = false;
        super.onDestroy();
    }

    // ── Notificação ─────────────────────────────────────────────────────────

    private void criarCanal() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CANAL_ID) != null) return;
        NotificationChannel canal = new NotificationChannel(
                CANAL_ID, "Treino em andamento", NotificationManager.IMPORTANCE_LOW);
        canal.setDescription("Mantém o progresso do treino visível enquanto você treina.");
        canal.setShowBadge(false);
        nm.createNotificationChannel(canal);
    }

    private Notification construirNotificacao(String titulo, String texto) {
        criarCanal();

        Intent abrir = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent toque = null;
        if (abrir != null) {
            abrir.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
            toque = PendingIntent.getActivity(this, 0, abrir, flags);
        }

        return new NotificationCompat.Builder(this, CANAL_ID)
                .setContentTitle(titulo != null ? titulo : "S2Core · Treino em andamento")
                .setContentText(texto != null ? texto : "Preparando...")
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setContentIntent(toque)
                .build();
    }

    /**
     * Mesmo cuidado do `LocationForegroundService`: `startForeground()` pode
     * lançar `ForegroundServiceStartNotAllowedException` (Android 12+) se o
     * sistema decidir que o app não pode subir um serviço de primeiro plano
     * agora. Sem este try/catch, essa exceção derrubaria o app inteiro em vez
     * de só deixar a notificação do treino sem aparecer.
     */
    private void subirParaPrimeiroPlano(String titulo, String texto) {
        Notification n = construirNotificacao(titulo, texto);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICACAO_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            } else {
                startForeground(NOTIFICACAO_ID, n);
            }
        } catch (Exception e) {
            Log.w(TAG, "startForeground negado: " + e.getMessage());
            ativo = false;
            stopSelf();
        }
    }

    private void atualizarNotificacao(String titulo, String texto) {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.notify(NOTIFICACAO_ID, construirNotificacao(titulo, texto));
    }

    private void encerrar() {
        ativo = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(Service.STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        stopSelf();
    }
}
