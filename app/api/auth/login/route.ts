import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { initDB, queryOne, UsuarioRow } from '@/lib/db'
import { createSession } from '@/lib/api-session'

export async function POST(req: NextRequest) {
  try {
    await initDB()

    const body = await req.json()
    const email: string = (body.email ?? '').toLowerCase().trim()
    const password: string = body.password ?? ''

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 })
    }

    const user = await queryOne<UsuarioRow>(
      'SELECT * FROM usuarios WHERE email = $1 AND activo = true',
      [email],
    )

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
    }

    await createSession({
      userId: user.id,
      tallerId: user.taller_id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      superadmin: user.superadmin,
    })

    return NextResponse.json({
      ok: true,
      usuario: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol, superadmin: user.superadmin },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[login]', msg)
    const isDev = process.env.NODE_ENV !== 'production'
    const friendly = msg.includes('ECONNREFUSED') || msg.includes('connect')
      ? 'No se pudo conectar a la base de datos. Verifica que PostgreSQL esté corriendo.'
      : isDev
      ? `Error: ${msg}`
      : 'Error interno del servidor'
    return NextResponse.json({ error: friendly }, { status: 500 })
  }
}
