package com.s2core.app.workout;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

/**
 * Serviço de primeiro plano da Lock Screen do treino de musculação (P1D) +
 * Voice Workout (P5A).
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
 *
 * ## Voice Workout (P5A) — o que este serviço ganhou
 *
 * `ativarTipoMicrofone()`/`desativarTipoMicrofone()` somam/tiram o tipo
 * `microphone` do MESMO serviço, chamando `startForeground` de novo com o
 * bitmask combinado — sem subir um segundo serviço nem uma segunda
 * notificação. `ACTION_LISTEN` é o alvo da ação "Falar" da notificação: o
 * toque chega aqui via `PluginCall`-less `Intent` (não precisa do app em
 * primeiro plano porque o serviço JÁ está em foreground — não é criação de
 * um FGS novo em background, é comando para um que já existe) e delega para
 * o callback que o `VoiceWorkoutPlugin` registrou em `load()`.
 *
 * ## `onTimeout` (Android 15+) — hardening independente da voz
 *
 * A partir do targetSdk 35 o tipo `dataSync` tem teto de 6h por 24h; o
 * sistema chama `onTimeout` perto do limite, e um serviço que não para a
 * tempo é derrubado pelo próprio SO. Um treino comum (1-2h) nunca bate no
 * teto, mas um rascunho esquecido aberto (ver `LIMITE_SESSAO_ATIVA_MS` no
 * web) poderia. `microphone` não tem este teto — só o cobre quando a voz
 * está desligada.
 */
public class WorkoutForegroundService extends Service {

    public static final String ACTION_START = "com.s2core.app.workout.START";
    public static final String ACTION_UPDATE = "com.s2core.app.workout.UPDATE";
    public static final String ACTION_STOP = "com.s2core.app.workout.STOP";
    public static final String ACTION_ENABLE_VOICE = "com.s2core.app.workout.ENABLE_VOICE";
    public static final String ACTION_DISABLE_VOICE = "com.s2core.app.workout.DISABLE_VOICE";
    public static final String ACTION_LISTEN = "com.s2core.app.workout.LISTEN";

    public static final String EXTRA_TITLE = "titulo";
    public static final String EXTRA_TEXT = "texto";

    private static final String TAG = "S2CoreWorkout";
    private static final String CANAL_ID = "s2core_workout";
    private static final int NOTIFICACAO_ID = 4712;
    private static final int REQUEST_CODE_TOQUE = 0;
    private static final int REQUEST_CODE_FALAR = 1;

    private static volatile boolean ativo = false;
    /** Voice Workout ligado — decide o tipo do FGS e a ação "Falar" da notificação. */
    private static volatile boolean vozAtiva = false;
    /** Callback do `VoiceWorkoutPlugin`, registrado em `load()`/removido em `handleOnDestroy`. */
    private static volatile Runnable ouvirCallback;

    // Último título/corpo enviados pelo web — reaproveitados ao religar/desligar
    // a voz, que não traz texto novo (só muda o TIPO do serviço).
    private String tituloAtual;
    private String textoAtual;

    public static boolean estaAtivo() {
        return ativo;
    }

    public static boolean vozEstaAtiva() {
        return vozAtiva;
    }

    /** Chamado pelo `VoiceWorkoutPlugin` em `load()`/`handleOnDestroy()`. */
    public static void setOuvirCallback(Runnable callback) {
        ouvirCallback = callback;
    }

    public static void ativarTipoMicrofone(Context context) {
        enviarAcaoEstatica(context, ACTION_ENABLE_VOICE);
    }

    public static void desativarTipoMicrofone(Context context) {
        enviarAcaoEstatica(context, ACTION_DISABLE_VOICE);
    }

    private static void enviarAcaoEstatica(Context context, String acao) {
        Intent i = new Intent(context, WorkoutForegroundService.class);
        i.setAction(acao);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(context, i);
        } else {
            context.startService(i);
        }
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
            case ACTION_ENABLE_VOICE: {
                vozAtiva = true;
                if (ativo) subirParaPrimeiroPlano(tituloAtual, textoAtual);
                break;
            }
            case ACTION_DISABLE_VOICE: {
                vozAtiva = false;
                if (ativo) subirParaPrimeiroPlano(tituloAtual, textoAtual);
                break;
            }
            case ACTION_LISTEN: {
                // Toque na ação "Falar" da notificação. Não é criação de um FGS
                // novo em background — o serviço já está em foreground; só
                // delega ao plugin, que decide se há permissão/captura em curso.
                Runnable callback = ouvirCallback;
                if (callback != null) callback.run();
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
        vozAtiva = false;
        super.onDestroy();
    }

    /**
     * Android 15+ (API 35): chamado perto do teto de 6h/24h do tipo `dataSync`
     * quando o serviço não parou sozinho. Sem esta parada explícita o sistema
     * derruba o app inteiro, não só o serviço — o mesmo padrão de segurança do
     * `try/catch` em `subirParaPrimeiroPlano`, aqui para o lado do TEMPO em vez
     * do lado da PERMISSÃO. Override seguro em qualquer minSdk: o método só
     * existe como callback do SO a partir da API 35 — em aparelhos mais
     * antigos, simplesmente nunca é chamado.
     */
    public void onTimeout(int startId, int fgsType) {
        Log.w(TAG, "onTimeout do foreground service (tipo " + fgsType + ") — encerrando");
        encerrar();
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
            toque = PendingIntent.getActivity(this, REQUEST_CODE_TOQUE, abrir, flags);
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CANAL_ID)
                .setContentTitle(titulo != null ? titulo : "S2Core · Treino em andamento")
                .setContentText(texto != null ? texto : "Preparando...")
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setContentIntent(toque);

        // Ação "Falar" (P5A) — só existe com a voz ligada. Não exige o app em
        // primeiro plano: o serviço já é foreground, então tratar o Intent
        // não esbarra na restrição de Android 14+ de criar FGS de microfone
        // a partir de segundo plano.
        if (vozAtiva) {
            Intent falar = new Intent(this, WorkoutForegroundService.class);
            falar.setAction(ACTION_LISTEN);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
            PendingIntent pendingFalar = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? PendingIntent.getForegroundService(this, REQUEST_CODE_FALAR, falar, flags)
                    : PendingIntent.getService(this, REQUEST_CODE_FALAR, falar, flags);
            builder.addAction(android.R.drawable.ic_btn_speak_now, "Falar", pendingFalar);
        }

        return builder.build();
    }

    /**
     * Mesmo cuidado do `LocationForegroundService`: `startForeground()` pode
     * lançar `ForegroundServiceStartNotAllowedException` (Android 12+) se o
     * sistema decidir que o app não pode subir um serviço de primeiro plano
     * agora. Sem este try/catch, essa exceção derrubaria o app inteiro em vez
     * de só deixar a notificação do treino sem aparecer.
     *
     * Também é chamado ao LIGAR/DESLIGAR a voz (P5A) — nesse caso `ativo` já
     * era `true` e o texto é o mesmo de antes; só o TIPO do serviço muda.
     */
    private void subirParaPrimeiroPlano(String titulo, String texto) {
        tituloAtual = titulo;
        textoAtual = texto;
        Notification n = construirNotificacao(titulo, texto);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                int tipo = ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC;
                if (vozAtiva) tipo |= ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
                startForeground(NOTIFICACAO_ID, n, tipo);
            } else {
                startForeground(NOTIFICACAO_ID, n);
            }
        } catch (Exception e) {
            Log.w(TAG, "startForeground negado: " + e.getMessage());
            // A voz não pôde subir — não deixar o estado interno mentir que
            // está ativa quando a notificação (e o tipo do serviço) não
            // acompanhou.
            vozAtiva = false;
            ativo = false;
            stopSelf();
        }
    }

    private void atualizarNotificacao(String titulo, String texto) {
        tituloAtual = titulo;
        textoAtual = texto;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.notify(NOTIFICACAO_ID, construirNotificacao(titulo, texto));
    }

    private void encerrar() {
        ativo = false;
        vozAtiva = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(Service.STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        stopSelf();
    }
}
